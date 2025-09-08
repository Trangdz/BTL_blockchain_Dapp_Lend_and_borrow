import type { NextPage } from "next";
import Head from "next/head";
import { useContext, useEffect } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.min.css";
import lendContext from "../context/lendContext";
import { Header, MainCard, LendingPool, DisconnectedTab, HealthFactorCard, AssetMetrics, RefreshDataButton } from "../components";

const Home: NextPage = () => {
  const {
    connectWallet,
    metamaskDetails,
    getUserAssets,
    getYourSupplies,
    getAssetsToBorrow,
    updateInterests,
    getYourBorrows,
    // LendHub v2 data
    healthFactor = "0",
    borrowPower = "0", 
    utilizationRate = "0",
    assetMetrics = [],
  } = useContext(lendContext);

  useEffect(() => {
    // connectWallet();
  }, []);

  useEffect(() => {
    // setInterval(() => connectWallet(), 5000);
    // updateInterests();

    // Only call these if wallet is connected
    if (metamaskDetails.currentAccount && metamaskDetails.contractAddresses) {
      console.log("🔄 Fetching user data...");
      try {
        getUserAssets();
        getYourSupplies();
        getAssetsToBorrow();
        getYourBorrows();
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    }
  }, [metamaskDetails]);

  return (
    <div>
      <Head>
        <title>LendHub - DeFi Lending and Borrowing Protocol</title>
        <link rel="icon" href="/lendhub-favi.png" />
      </Head>

      <main className="w-full p-0 m-0">
        <div>
          <div>{}</div>
          <div className="App bg-gradient-to-b from-[#212430] to-[#17171a] h-[12rem] text-white">
            <Header />
            <MainCard />
          </div>

          {!metamaskDetails.currentAccount ? (
            <DisconnectedTab />
          ) : (
            <div>
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Health Factor Card - Only show if user has positions */}
                {(parseFloat(healthFactor) > 0 || parseFloat(borrowPower) > 0) && (
                  <HealthFactorCard 
                    healthFactor={healthFactor}
                    borrowPower={borrowPower}
                    utilizationRate={utilizationRate}
                  />
                )}
                
                {/* Asset Metrics - Market Overview */}
                <AssetMetrics assetData={assetMetrics} />
              </div>
              
              {/* Original LendingPool component */}
              <LendingPool />
              
              {/* Refresh Data Button */}
              <RefreshDataButton />
            </div>
          )}
        </div>
      </main>

      <ToastContainer
        position="top-center"
        autoClose={2000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
};

export default Home;
