﻿using FunFair.Ethereum.Contracts;
using FunFair.Ethereum.DataTypes.Primitives;
using FunFair.Labs.ScalingEthereum.Contracts.GameManager.Events;
using FunFair.Labs.ScalingEthereum.Contracts.GameManager.Transactions;
using FunFair.Labs.ScalingEthereum.Contracts.Networks;

namespace FunFair.Labs.ScalingEthereum.Contracts.GameManager
{
    /// <summary>
    ///     Game Manager
    /// </summary>
    public static class GameManagerContract
    {
        /// <summary>
        ///     Creates the Game Manager Contract.
        /// </summary>
        /// <returns></returns>
        public static IContractInfo Create()
        {
            return ContractInfoBuilder.Create(WellKnownContracts.GameManager)
                                      .Network(network: Layer2EthereumNetworks.OptimismKovan, new ContractAddress("0xb515b6936E51CB86EDa03f68dF495E2e133713f8"))
                                      .Transaction<StartGameRound>()
                                      .Transaction<CloseGameRoundForNewBets>()
                                      .Transaction<EndGameRound>()
                                      .Event<StartGameRoundEvent>()
                                      .Event<EndGameRoundEvent>()
                                      .Event<NoMoreBetsEvent>()
                                      .Build();
        }
    }
}