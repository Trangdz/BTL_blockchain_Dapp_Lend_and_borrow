import React, { useContext, useEffect } from "react";
import { ConnectButton } from "../components";
import { logo } from "../assets";
import Image from "next/image";
import lendContext from "../context/lendContext";

const Header = () => {
  const { metamaskDetails } = useContext(lendContext);
  
  const getNetworkDisplay = () => {
    if (!metamaskDetails.chainId) return "";
    
    switch (metamaskDetails.chainId) {
      case 1337:
        return (
          <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs">
            🟢 Ganache Local
          </span>
        );
      case 11155111:
        return (
          <span className="bg-blue-600 text-white px-2 py-1 rounded-full text-xs">
            🔵 Sepolia Testnet
          </span>
        );
      default:
        return (
          <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs">
            ⚠️ Unsupported Network
          </span>
        );
    }
  };

  return (
    <nav className="w-full h-15 text-white flex py-2 px-4 lg:px-10 justify-between items-center border-b-[1px] border-gray-400">
      <div className="flex items-center space-x-4">
        <a href="/">
          <Image src={logo} alt="LendHub Logo" className="w-40 hover:opacity-80" />
        </a>
        {metamaskDetails.currentAccount && (
          <div className="hidden md:block">
            {getNetworkDisplay()}
          </div>
        )}
      </div>
      
      <div className="flex items-center space-x-4">
        {metamaskDetails.currentAccount && (
          <div className="block md:hidden">
            {getNetworkDisplay()}
          </div>
        )}
        <ConnectButton />
      </div>
    </nav>
  );
};

export default Header;
