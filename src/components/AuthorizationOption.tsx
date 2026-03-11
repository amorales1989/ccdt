
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
        return <Tent className="h-10 w-10" />;
      case 'signpost':
        return <SignpostBig className="h-10 w-10" />;
    }
  };

  return (
    <div
      className="group relative bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 hover:border-purple-300/50 dark:hover:border-purple-500/50 transition-all duration-300 cursor-pointer overflow-hidden p-8"
      onClick={() => navigate(route)}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

      <div className="relative z-10 flex flex-col items-center text-center space-y-4">
        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl text-purple-600 dark:text-purple-400 group-hover:scale-110 group-hover:bg-purple-100 dark:group-hover:bg-purple-800/30 transition-transform duration-300">
          {renderIcon()}
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors uppercase tracking-wide">
            {title}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthorizationOption;
