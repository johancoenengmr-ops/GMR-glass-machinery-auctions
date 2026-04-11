import React from 'react';
import { useParams } from 'react-router-dom';
import AuctionDetail from '../components/AuctionDetail';

const AuctionDetailPage = () => {
    const { id } = useParams();

    return <AuctionDetail auctionId={id} />;
};

export default AuctionDetailPage;
