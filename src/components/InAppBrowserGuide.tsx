'use client';

import { useEffect, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';

export default function InAppBrowserGuide() {
  const [isInApp, setIsInApp] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isInAppBrowser = /KAKAOTALK|Line|NAVER|FBAN|FBAV|Instagram/i.test(userAgent);
    
    if (isInAppBrowser) {
      setIsInApp(true);
    }
  }, []);

  if (!isInApp || isDismissed) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 relative animate-in slide-in-from-top duration-500">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-amber-800 text-xs md:text-sm font-medium">
          <ExternalLink size={16} className="shrink-0" />
          <p>
            인앱 브라우저(카카오톡 등)에서는 <span className="font-bold text-amber-900">Google 로그인이 제한</span>될 수 있습니다. 
            원활한 이용을 위해 <span className="underline decoration-amber-400 decoration-2 underline-offset-2">외부 브라우저(Chrome, Safari 등)</span>로 접속해주세요.
          </p>
        </div>
        <button 
          onClick={() => setIsDismissed(true)}
          className="p-1 hover:bg-amber-100 rounded-full text-amber-600 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
