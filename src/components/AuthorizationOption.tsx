
import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tent, SignpostBig } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AuthorizationOptionProps {
  title: string;
  description: string;
  icon: 'tent' | 'signpost';
  route: string;
}

const AuthorizationOption = ({ title, description, icon, route }: AuthorizationOptionProps) => {
  const navigate = useNavigate();
  
  const renderIcon = () => {
    switch (icon) {
      case 'tent':
        return <Tent className="h-12 w-12 mb-4" />;
      case 'signpost':
        return <SignpostBig className="h-12 w-12 mb-4" />;
    }
  };

  return (
    <Card 
      className="cursor-pointer hover:bg-accent transition-colors"
      onClick={() => navigate(route)}
    >
      <CardHeader className="text-center">
        {renderIcon()}
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
};

export default AuthorizationOption;
