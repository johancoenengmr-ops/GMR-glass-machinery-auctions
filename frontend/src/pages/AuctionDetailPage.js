import React from 'react';
import { useParams } from 'react-router-dom';
import AuctionDetail from '../components/AuctionDetail';

const AuctionDetailPage = () => {
    const { id: auctionId } = useParams();

    return (
        <div>
            <h1>Auction Detail Page</h1>
            <AuctionDetail auctionId={auctionId} />
        </div>
    );
};

export default AuctionDetailPage;
