import React from 'react';
import { APP_NAME } from '../constants';

const Header: React.FC = () => {
  return (
    <header className="bg-slate-900 border-b border-slate-700 py-4 px-6 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
          T
        </div>
        <h1 className="text-xl font-semibold text-slate-100 tracking-tight">{APP_NAME}</h1>
      </div>
      <div className="flex items-center gap-4 text-sm text-slate-400">
        <span className="hidden md:inline">v1.0.0 Beta</span>
        <a href="#" className="hover:text-blue-400 transition-colors">Documentation</a>
        <a href="#" className="hover:text-blue-400 transition-colors">Support</a>
      </div>
    </header>
  );
};

export default Header;
