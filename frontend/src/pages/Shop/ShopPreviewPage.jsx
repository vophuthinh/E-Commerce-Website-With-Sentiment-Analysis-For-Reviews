import React from 'react';
import styles from '../../styles/styles';
import ShopInfo from '../../components/Shop/ShopInfo';
import ShopProfileData from '../../components/Shop/ShopProfileData';
import Header from '../../components/Layout/Header';

const ShopPreviewPage = () => {
    return (
        <div className="bg-[#f0f2f5] min-h-screen">
            <Header />
            <div className={`${styles.section}`} style={{ marginTop: '70px' }}>
                <div className="flex flex-col 800px:flex-row gap-5">
                    {/* Shop Info */}
                    <div className="800px:w-[25%] bg-white rounded-lg shadow-lg p-5 h-fit 800px:sticky top-[90px]">
                        <ShopInfo isOwner={false} />
                    </div>

                    {/* Shop Profile Data */}
                    <div className="flex-1 bg-white rounded-lg shadow-lg p-5">
                        <ShopProfileData isOwner={false} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShopPreviewPage;
