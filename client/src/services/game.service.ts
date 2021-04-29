import { hexlify, Interface } from 'ethers/lib/utils';
import { LabRatsToken } from '../contracts/LabRatsToken';
import LabRatsTokenABI from '../contracts/labRatsToken.json';
import { MultiplayerGamesManager } from '../contracts/MultiplayerGamesManager';
import MultiplayerGamesManagerABI from '../contracts/multiplayerGamesManager.json';
import { Bet } from '../model/bet';
import { BlockHeader } from '../model/blockHeader';
import { RoundResult } from '../model/roundResult';
import { setResult } from '../store/actions/game.actions';
import { setUserError } from '../store/actions/user.actions';
import store from '../store/store';
import { ethers } from './ether.service';
import { messageService } from './message.service';

class GameService {
  // private GAME_ADDRESS = '0xb5F20F66F8a48d70BbBF8ACC18E28907f97ee552';
  private GAME_MANAGER_ADDRESS = '0x6F98A24C2e76286F15B285Ba73Cb764F8D504029';//prev'0xe3f2Fa6a3F16837d012e1493F50BD29db0BdADe4';
  private TOKEN_ADDRESS = '0x11160251d4283A48B7A8808aa0ED8EA5349B56e2';

  private debugEncodeBet(bet: Bet): string {

    const leftPadValue = (value: string, digits=64) => {
      return Array(Math.max(digits - value.length + 1, 0)).join('0') + value;
    }


    const uint256Type = '0000000000000000000000000000000000000000000000000000000000000020';
    const roundId = bet.roundId.substring(2);
    const arrayType = '0000000000000000000000000000000000000000000000000000000000000040';
    const storageType = '0000000000000000000000000000000000000000000000000000000000000060';
    const arrayLength = '0000000000000000000000000000000000000000000000000000000000000001';
    const address = `000000000000000000000000${bet.address.substring(2)}`
    const betAmount = leftPadValue(hexlify(bet.amount).substring(2));
    const betData = leftPadValue(hexlify(bet.data).substring(2));

    return `${uint256Type}${roundId}${arrayType}${arrayLength}${uint256Type}${address}${betAmount}${storageType}${uint256Type}${betData}`;
  }

  public async handlePlay(bet: Bet) {

    //TODO: move to game.ts
    const state = store.getState();
    bet.roundId = state.game.round?.id as string;
    bet.address = state.user.address as string;

    if (!bet.roundId) {
      store.dispatch(setUserError('Invalid round ID'));
      throw new Error('Error placing bet. Round id not found');
    }

    const abi = new Interface([
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            name: '_roundID',
            type: 'bytes32',
          },
          {
            components: [
              {
                name: 'playerAddress',
                type: 'address',
              },
              {
                name: 'betAmount',
                type: 'uint256',
              },
              {
                name: 'betData',
                type: 'bytes',
              },
            ],
            indexed: false,
            name: '_bet',
            type: 'tuple[]',
          },
        ],
        name: 'bet',
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ]);

    const calldata = abi.encodeFunctionData('bet', [
      bet.roundId,
      [
        {
          playerAddress: bet.address,
          betAmount: hexlify(bet.amount),
          betData: hexlify(bet.data),
        },
      ],
    ]);

    const contract = await ethers.getContract<LabRatsToken>(
      LabRatsTokenABI,
      this.TOKEN_ADDRESS
    );
    const transactionResponse = await contract.transferAndCall(
      this.GAME_MANAGER_ADDRESS,
      bet.amount,
      calldata
    );
    const receipt = await transactionResponse.wait(1);
    console.log('handlePlay receipt: ', receipt);
    // TODO: dispatch confirmation to store
  }
  
  public async handlePlayWithAbiCoder(bet: Bet) {

    //TODO: move to game.ts
    const state = store.getState();
    bet.roundId = state.game.round?.id as string;
    bet.address = state.user.address as string;
    
    if (!bet.roundId) {
      store.dispatch(setUserError('Invalid round ID'));
      throw new Error('Error placing bet. Round id not found');
    }

    const encoded = ethers.encode(
      [
        {
            name: 'TokenTransferData',
            indexed: false,
            type: 'tuple',
            components: [
              {
                name: 'roundID',
                indexed: false,
                type: 'bytes32',
              },
              {
                name: 'bets',
                indexed: false,
                type: 'tuple[]',
                components: [
                  {
                    name: 'playerAddress',
                    indexed: false,
                    type: 'address',
                  },
                  {
                    name: 'betAmount',
                    indexed: false,
                    type: 'uint256',
                  },
                  {
                    name: 'betData',
                    indexed: false,
                    type: 'bytes',
                  }
                ]
              }
            ]
        }
      ],
      [
        {
          roundID: bet.roundId,
          bets: [
            {
              playerAddress: bet.address,
              betAmount: hexlify(bet.amount),
              betData: bet.data,
            },
          ],
        }

      ]
    );

    const contract = await ethers.getContract<LabRatsToken>(
      LabRatsTokenABI,
      this.TOKEN_ADDRESS
    );

    console.log('++ sending transferAndCall');
    console.log('++ roundId:', bet.roundId);
    console.log('++ address:', this.TOKEN_ADDRESS);
    console.log('++ amount:', bet.amount.toString());
    console.log('++ unencoded data:', hexlify(bet.data));
    console.log('++ encoded data:', encoded);

    const transactionResponse = await contract.transferAndCall(
      this.GAME_MANAGER_ADDRESS,
      bet.amount,
      encoded
    );
    
    messageService.broadcastBet(bet);

    const receipt = await transactionResponse.wait(1);
    console.log('handlePlay receipt: ', receipt);
    // TODO: dispatch confirmation to store
  }

  public async testForRoundStart(blockHeader: BlockHeader) {
    const eventName = 'StartGameRound';
    // TODO: isInBloom ... [contract, eventName, roundId]
    const contract = await ethers.getContract<MultiplayerGamesManager>(MultiplayerGamesManagerABI, this.GAME_MANAGER_ADDRESS);
    const events: Event[] = await (contract as any).queryFilter(
      eventName,
      blockHeader.blockHash
    );

    events.forEach((event: Event) => {
      // const result: RoundResult = { test: event };
      //@ts-ignore
      store.dispatch(setRoundId(event._roundID));
    });
  }

  public async testForRoundResult(blockHeader: BlockHeader) {
    const eventName = 'EndGameRound';
    // TODO: isInBloom ... [contract, eventName, roundId]
    const contract = await ethers.getContract<MultiplayerGamesManager>(MultiplayerGamesManagerABI, this.GAME_MANAGER_ADDRESS);
    const events: Event[] = await (contract as any).queryFilter(
      eventName,
      blockHeader.blockHash
    );

    events.forEach((event) => {
      const result: RoundResult = { test: event, persistentGameData: null };
      store.dispatch(setResult(result));
    });
  }
}

export const gameService = new GameService();
