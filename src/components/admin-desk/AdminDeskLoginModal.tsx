import React, { useState } from 'react';
import { Lock } from 'lucide-react';

interface AdminDeskLoginModalProps {
  onSuccess: () => void;
  onLogin?: () => void;
}

export const AdminDeskLoginModal: React.FC<AdminDeskLoginModalProps> = ({
  onSuccess,
  onLogin
}) => {
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (loginUser.toUpperCase() === 'ADMIN' && loginPass === 'Admin@1234') {
      onSuccess();
      if (onLogin) onLogin();
    } else if (loginUser.toUpperCase() !== 'ADMIN') {
      setError('AUTHENTICATION DENIED: ADMIN PRIVILEGES REQUIRED.');
    } else {
      setError('AUTHENTICATION DENIED: INVALID PASSWORD.');
    }
  };

  return (
    <div className="h-screen w-full bg-[#dfdfdf] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm bg-[#E8E6E1] border-t-white border-l-white border-b-slate-800 border-r-slate-800 border-2 shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]">
        <div className="bg-[#000080] text-white px-2 py-1 flex justify-between items-center h-8">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-widest italic">Admin Master Lock</span>
          </div>
        </div>
        <div className="p-8 space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-black text-indigo-950 italic">Administrative Vault</h2>
            <p className="text-[9px] font-extrabold text-[#000080] uppercase tracking-widest leading-none">Console Override</p>
          </div>
          {error && <div className="p-2 border border-rose-300 bg-rose-50 text-rose-800 text-[10px] uppercase font-bold text-center">{error}</div>}
          <div className="space-y-4">
            <input
              id="operator_id_input"
              name="operator_id"
              aria-label="Operator ID"
              value={loginUser}
              onChange={(e) => setLoginUser(e.target.value)}
              className="w-full bg-white border border-slate-300 p-2 text-sm uppercase outline-none placeholder:text-slate-300 font-bold"
              placeholder="Operator ID"
            />
            <input
              id="password_input"
              name="password"
              aria-label="Password"
              type="password"
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
              className="w-full bg-white border border-slate-300 p-2 text-sm outline-none placeholder:text-slate-300 font-bold"
              placeholder="Password"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLogin();
              }}
            />
            <button
              onClick={handleLogin}
              className="w-full py-3 bg-[#000080] text-white font-black uppercase text-[11px] tracking-[0.2em] cursor-pointer hover:bg-blue-900 transition active:scale-95"
            >
              DESTRUCT CRITICAL OVERRIDE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
