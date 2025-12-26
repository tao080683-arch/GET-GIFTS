
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Tab, NFTItem, Language, Rarity } from './types';
import { CASES_DATA, FREE_CASES, PROMO_CODES, NFT_POOL, RARITY_VALUES, TRANSLATIONS } from './constants';

const GlassCard: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className, onClick }) => (
  <div onClick={onClick} className={`glass rounded-[32px] shadow-2xl transition-all duration-300 active:scale-95 ${className}`}>
    {children}
  </div>
);

const App: React.FC = () => {
  const [lang] = useState<Language>('ru');
  const [activeTab, setActiveTab] = useState<Tab>(Tab.CASES);
  
  // Data State
  const [balance, setBalance] = useState<number>(() => parseInt(localStorage.getItem('nft_stars_balance') || '1500'));
  const [totalRecharged, setTotalRecharged] = useState<number>(() => parseInt(localStorage.getItem('nft_total_recharged') || '0'));
  const [inventory, setInventory] = useState<NFTItem[]>(() => JSON.parse(localStorage.getItem('nft_stars_inventory') || '[]'));
  const [lastPromoUsed, setLastPromoUsed] = useState<number>(() => parseInt(localStorage.getItem('nft_last_promo') || '0'));
  const [topupUsage, setTopupUsage] = useState<Record<string, number>>(() => JSON.parse(localStorage.getItem('nft_topup_usage') || '{}'));

  const t = useMemo(() => TRANSLATIONS[lang], [lang]);
  const tonConnectUIRef = useRef<any>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  // UI States
  const [isOpeningCase, setIsOpeningCase] = useState(false);
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isSellAllModalOpen, setIsSellAllModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [caseQty, setCaseQty] = useState(1);
  const [wonItems, setWonItems] = useState<NFTItem[]>([]);
  const [currentWonIndex, setCurrentWonIndex] = useState(0);
  const [freePromoInput, setFreePromoInput] = useState('');
  const [tonAmount, setTonAmount] = useState('');
  const [isProcessingTx, setIsProcessingTx] = useState(false);

  // Upgrade State
  const [upgradeNft, setUpgradeNft] = useState<NFTItem | null>(null);
  const [upgradeTargetNft, setUpgradeTargetNft] = useState<NFTItem | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeRotation, setUpgradeRotation] = useState(0);
  const [upgradeResult, setUpgradeResult] = useState<'win' | 'loss' | null>(null);
  const [isSelectingForUpgrade, setIsSelectingForUpgrade] = useState(false);
  const [isSelectingTargetNft, setIsSelectingTargetNft] = useState(false);

  // Craft State
  const [selectedForCraft, setSelectedForCraft] = useState<NFTItem[]>([]);
  const [isSelectingForCraft, setIsSelectingForCraft] = useState(false);
  const [isCrafting, setIsCrafting] = useState(false);

  // PvP State
  const [pvpStatus, setPvpStatus] = useState<'waiting' | 'countdown' | 'spinning' | 'result'>('waiting');
  const [pvpPlayers, setPvpPlayers] = useState<any[]>([]);
  const [pvpTimeLeft, setPvpTimeLeft] = useState(0);
  const [pvpWinner, setPvpWinner] = useState<string | null>(null);
  const [pvpRotation, setPvpRotation] = useState(0);
  const [pvpBetAmount, setPvpBetAmount] = useState('100');

  // Sync Storage
  useEffect(() => {
    localStorage.setItem('nft_stars_balance', balance.toString());
    localStorage.setItem('nft_total_recharged', totalRecharged.toString());
    localStorage.setItem('nft_stars_inventory', JSON.stringify(inventory));
    localStorage.setItem('nft_last_promo', lastPromoUsed.toString());
    localStorage.setItem('nft_topup_usage', JSON.stringify(topupUsage));
  }, [balance, totalRecharged, inventory, lastPromoUsed, topupUsage]);

  useEffect(() => {
    const initTon = () => {
      try {
        if ((window as any).TonConnectUI) {
          tonConnectUIRef.current = new (window as any).TonConnectUI.TonConnectUI({
            manifestUrl: 'https://raw.githubusercontent.com/ton-connect/demo-dapp-with-react/master/public/tonconnect-manifest.json',
            buttonRootId: 'ton-connect-placeholder'
          });
          tonConnectUIRef.current.onStatusChange((wallet: any) => setIsWalletConnected(!!wallet));
        } else {
          setTimeout(initTon, 500);
        }
      } catch (e) {
        console.error("TonConnect init failed", e);
        setTimeout(initTon, 1000);
      }
    };
    initTon();
  }, []);

  const openWallet = () => {
    if (tonConnectUIRef.current) {
      tonConnectUIRef.current.openModal();
    } else {
      alert("Кошелек не инициализирован");
    }
  };

  // Handlers
  const handleOpenCase = (c: any, qty: number) => {
    const now = Date.now();
    if (c.type === 'promo') {
      if (freePromoInput.toUpperCase() !== 'FREE') { alert(t.promo_err); return; }
      if (now - lastPromoUsed < 30 * 24 * 60 * 60 * 1000) { alert("Промокод можно раз в месяц!"); return; }
      setLastPromoUsed(now);
    } else if (c.type === 'topup') {
      if (totalRecharged < c.min) { alert(`Нужно ${c.min} STARS пополнений!`); return; }
      const last = topupUsage[c.id] || 0;
      if (new Date(last).toDateString() === new Date().toDateString()) { alert("Доступно раз в день!"); return; }
      setTopupUsage(prev => ({ ...prev, [c.id]: now }));
    } else {
      const price = c.price * qty;
      if (balance < price) { setIsRechargeModalOpen(true); return; }
      setBalance(p => p - price);
    }

    setIsOpeningCase(true);
    setTimeout(() => {
      const rewards: NFTItem[] = [];
      const pool = NFT_POOL.filter(n => n.rarity === c.rarity);
      const finalPool = pool.length > 0 ? pool : NFT_POOL;
      for (let i = 0; i < qty; i++) {
        const item = finalPool[Math.floor(Math.random() * finalPool.length)];
        rewards.push({ ...item, id: `won-${Date.now()}-${i}-${Math.random()}` });
      }
      setWonItems(rewards);
      setCurrentWonIndex(0);
      setIsOpeningCase(false);
    }, 1500);
  };

  const sellNFT = (item: NFTItem) => {
    setBalance(p => p + (item.value || 0));
    setInventory(p => p.filter(i => i.id !== item.id));
    setWonItems(p => p.filter(i => i.id !== item.id));
  };

  const sellAllInventory = () => {
    const total = inventory.reduce((a, b) => a + (b.value || 0), 0);
    setBalance(p => p + total);
    setInventory([]);
    setIsSellAllModalOpen(false);
  };

  const runUpgrade = () => {
    if (!upgradeNft || !upgradeTargetNft || isUpgrading) return;
    setIsUpgrading(true);
    setUpgradeResult(null);

    const winChance = upgradeNft.value! / upgradeTargetNft.value!;
    const winAngle = winChance * 360; 

    // Visual: Fixed circle, Needle rotates.
    // Logic: needle starts at top (0 deg), rotates clockwise.
    // Green sector is from 0 to winAngle.
    const randomStop = Math.random() * 360;
    const totalRotation = 360 * 10 + randomStop; // Slower: 10 spins instead of 15
    
    const finalAngle = randomStop % 360;
    const isWin = finalAngle <= winAngle;

    setUpgradeRotation(totalRotation);

    setTimeout(() => {
      setUpgradeResult(isWin ? 'win' : 'loss');
      if (isWin) {
        const newItem = { ...upgradeTargetNft, id: `up-${Date.now()}` };
        setInventory(prev => prev.filter(i => i.id !== upgradeNft.id));
        setWonItems([newItem]);
        setCurrentWonIndex(0);
      } else {
        setInventory(prev => prev.filter(i => i.id !== upgradeNft.id));
      }
      
      setTimeout(() => {
        setUpgradeNft(null);
        setUpgradeTargetNft(null);
        setIsUpgrading(false);
        setUpgradeRotation(0);
        setUpgradeResult(null);
      }, 2500);
    }, 5100); // Wait for the slower 5s animation
  };

  const runCraft = () => {
    if (selectedForCraft.length < 4 || isCrafting) return;
    setIsCrafting(true);

    setTimeout(() => {
      const totalValue = selectedForCraft.reduce((a, b) => a + (b.value || 0), 0);
      const targetValue = totalValue * 1.15;
      
      const suitablePool = NFT_POOL.filter(n => n.value! >= targetValue * 0.8);
      const sortedByValue = [...suitablePool].sort((a, b) => Math.abs(a.value! - targetValue) - Math.abs(b.value! - targetValue));
      const candidates = sortedByValue.slice(0, 5);
      const chosen = candidates[Math.floor(Math.random() * candidates.length)] || NFT_POOL[NFT_POOL.length - 1];

      const newItem = { ...chosen, id: `craft-${Date.now()}` };
      const selectedIds = selectedForCraft.map(s => s.id);
      
      // Cleanly update state once
      setInventory(prev => prev.filter(i => !selectedIds.includes(i.id)));
      setWonItems([newItem]);
      setCurrentWonIndex(0);
      setSelectedForCraft([]);
      setIsCrafting(false);
    }, 2000);
  };

  const handlePvpJoin = () => {
    const bet = parseInt(pvpBetAmount);
    if (balance < bet) { setIsRechargeModalOpen(true); return; }
    setBalance(p => p - bet);
    
    const botBet = bet + Math.floor(Math.random() * 50);
    const players = [
      { name: 'Вы', bet, id: 'you', color: '#3b82f6', avatar: 'https://picsum.photos/seed/you/100' },
      { name: 'Player 2', bet: botBet, id: 'bot', color: '#ec4899', avatar: 'https://picsum.photos/seed/bot/100' }
    ];
    
    setPvpPlayers(players);
    setPvpStatus('countdown');
    setPvpTimeLeft(60); // 60 seconds delay
    
    const timer = setInterval(() => setPvpTimeLeft(p => {
      if (p <= 1) { clearInterval(timer); return 0; }
      return p - 1;
    }), 1000);

    setTimeout(() => {
      setPvpStatus('spinning');
      const randomStop = Math.random() * 360;
      const rot = 360 * 10 + randomStop; // Slow spin
      setPvpRotation(rot);
      
      setTimeout(() => {
        // Fair Winner Logic based on Wheel Slices
        const totalPot = bet + botBet;
        const yourSlice = (bet / totalPot) * 360;
        
        // Final needle point relative to static wheel
        const needleAngle = randomStop % 360;
        const winnerObj = needleAngle <= yourSlice ? players[0] : players[1];
        
        setPvpWinner(winnerObj.name);
        setPvpStatus('result');
        
        if (winnerObj.id === 'you') {
          const commission = 0.025;
          const winAmount = Math.floor(totalPot * (1 - commission));
          setBalance(p => p + winAmount);
          alert(`Вы выиграли! Приз за вычетом комиссии 2.5%: ${winAmount} STARS`);
        }
        
        setTimeout(() => { 
          setPvpStatus('waiting'); 
          setPvpPlayers([]); 
          setPvpWinner(null); 
          setPvpRotation(0); 
        }, 5000);
      }, 5100);
    }, 60000);
  };

  const handleTonRecharge = async () => {
    if (!tonAmount || !tonConnectUIRef.current) return;
    if (!isWalletConnected) { openWallet(); return; }
    setIsProcessingTx(true);
    try {
      const nano = (parseFloat(tonAmount) * 1000000000).toString();
      await tonConnectUIRef.current.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 60,
        messages: [{ address: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c", amount: nano }]
      });
      const stars = Math.floor(parseFloat(tonAmount) * 100);
      setBalance(p => p + stars);
      setTotalRecharged(p => p + stars);
      setIsRechargeModalOpen(false);
    } catch (e) { alert("Ошибка транзакции"); } finally { setIsProcessingTx(false); }
  };

  const getRarityClass = (r: Rarity) => {
    if (r === 'Legendary') return 'border-legendary';
    if (r === 'Epic') return 'border-epic';
    if (r === 'Rare') return 'border-rare';
    return 'border-common';
  };

  const sortedInventory = useMemo(() => [...inventory].sort((a, b) => (a.value || 0) - (b.value || 0)), [inventory]);

  return (
    <div className={`iphone-frame bg-[#0a0a1a] flex flex-col relative text-white ${upgradeResult === 'win' ? 'upgrade-bg-win' : upgradeResult === 'loss' ? 'upgrade-bg-loss' : ''}`}>
      {/* Header */}
      <div className="p-4 flex items-center justify-between z-10 border-b border-white/5 bg-black/40 backdrop-blur-2xl">
        <div onClick={() => setIsRechargeModalOpen(true)} className="flex items-center gap-2 bg-blue-600/20 px-4 py-2.5 rounded-full border border-blue-500/30 cursor-pointer active:scale-95 transition-all">
          <div className="bg-blue-500 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"><i className="fa-solid fa-plus"></i></div>
          <span className="text-sm font-black tracking-tight">✨ {balance.toLocaleString()}</span>
        </div>
        <button onClick={openWallet} className="glass px-4 py-2 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest active:scale-95">
          {isWalletConnected ? 'Кошелек' : 'Подключить'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-24">
        {activeTab === Tab.CASES && (
          <div className="animate-in fade-in duration-300 pt-6">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] mb-4 opacity-40 ml-2">{t.free_cases}</h2>
            <div className="grid grid-cols-2 gap-4 mb-10">
              {FREE_CASES.map(c => (
                <GlassCard key={c.id} onClick={() => { setCaseQty(1); setSelectedCase(c); }} className="p-6 flex flex-col items-center group">
                  <img src={c.image} className="w-24 h-24 mb-4 drop-shadow-2xl group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black uppercase text-center leading-tight opacity-70">{c.name}</span>
                </GlassCard>
              ))}
            </div>
            <h2 className="text-sm font-black uppercase tracking-[0.2em] mb-4 opacity-40 ml-2">{t.nft_cases}</h2>
            <div className="grid grid-cols-2 gap-4 pb-8">
              {CASES_DATA.map(c => (
                <GlassCard key={c.id} onClick={() => { setCaseQty(1); setSelectedCase(c); }} className="p-5 flex flex-col items-center group">
                  <div className="relative mb-4 w-full aspect-square rounded-[32px] overflow-hidden shine-effect">
                    <img src={c.image} alt={c.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  </div>
                  <h3 className="font-black text-[11px] mb-2 uppercase opacity-80">{c.name}</h3>
                  <div className="text-xs font-black text-blue-400 bg-blue-400/10 px-4 py-1.5 rounded-full border border-blue-400/20">{c.price} STARS</div>
                </GlassCard>
              ))}
            </div>
          </div>
        )}

        {activeTab === Tab.UPGRADE && (
          <div className="animate-in fade-in duration-500 flex flex-col items-center pt-6">
            <h2 className="text-xl font-black italic mb-8 uppercase tracking-widest">{t.upgrade}</h2>
            <div className="relative w-80 h-80 mb-10 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
                {upgradeNft && upgradeTargetNft && (
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#22c55e" strokeWidth="6"
                    strokeDasharray={`${(upgradeNft.value! / upgradeTargetNft.value!) * 283} 283`}
                    className="transition-all duration-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.6)]" strokeLinecap="round" />
                )}
              </svg>
              {/* FIXED: Needle rotates, circle stays still for exact visual sync */}
              <div className="absolute inset-0 transition-transform duration-[5s] ease-out" style={{ transform: `rotate(${upgradeRotation}deg)` }}>
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white clip-path-needle shadow-2xl"></div>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                {upgradeNft && upgradeTargetNft ? (
                  <div>
                    <span className="text-5xl font-black italic text-green-400 block tracking-tighter">{Math.round((upgradeNft.value! / upgradeTargetNft.value!) * 100)}%</span>
                    <span className="text-[10px] font-black uppercase opacity-40 tracking-widest">{t.win_chance}</span>
                  </div>
                ) : <span className="text-[10px] opacity-30 uppercase font-black max-w-[120px]">{t.select_nft}</span>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 w-full mb-8">
              <GlassCard onClick={() => !isUpgrading && setIsSelectingForUpgrade(true)} className={`p-6 h-48 flex flex-col items-center justify-center border-dashed border-2 ${upgradeNft ? 'border-blue-500 bg-blue-500/5' : 'border-white/10'}`}>
                {upgradeNft ? <img src={upgradeNft.image} className={`w-24 h-24 rounded-2xl ${getRarityClass(upgradeNft.rarity)} object-cover`} /> : <i className="fa-solid fa-plus text-2xl opacity-20"></i>}
              </GlassCard>
              <GlassCard onClick={() => !isUpgrading && upgradeNft && setIsSelectingTargetNft(true)} className={`p-6 h-48 flex flex-col items-center justify-center border-dashed border-2 ${upgradeTargetNft ? 'border-green-500 bg-green-500/5' : 'border-white/10'} ${!upgradeNft && 'opacity-20'}`}>
                {upgradeTargetNft ? <img src={upgradeTargetNft.image} className={`w-24 h-24 rounded-2xl ${getRarityClass(upgradeTargetNft.rarity)} object-cover`} /> : <i className="fa-solid fa-bullseye text-2xl opacity-20"></i>}
              </GlassCard>
            </div>
            <button disabled={!upgradeNft || !upgradeTargetNft || isUpgrading} onClick={runUpgrade} className="w-full bg-blue-600 py-6 rounded-[32px] font-black text-lg shadow-2xl shadow-blue-600/30 active:scale-95 disabled:opacity-20 uppercase tracking-widest">{isUpgrading ? t.processing : t.upgrade_btn}</button>
          </div>
        )}

        {activeTab === Tab.CRAFT && (
          <div className="animate-in fade-in duration-300 pt-6">
            <h2 className="text-xl font-black italic mb-8 uppercase tracking-widest">{t.craft}</h2>
            <GlassCard className="p-8 mb-8 min-h-[400px] flex flex-col items-center justify-center text-center">
              <div className="grid grid-cols-4 gap-3 mb-10 w-full">
                {/* UPGRADED: 12 item slots */}
                {Array.from({ length: 12 }).map((_, idx) => {
                  const item = selectedForCraft[idx];
                  return (
                    <div key={idx} onClick={() => item && setSelectedForCraft(p => p.filter(s => s.id !== item.id))} className={`w-full aspect-square glass rounded-xl border flex items-center justify-center overflow-hidden transition-all ${item ? getRarityClass(item.rarity) : 'border-white/5 opacity-40 border-dashed'}`}>
                      {item ? <img src={item.image} className="w-full h-full object-cover" /> : <i className="fa-solid fa-plus opacity-10 text-[10px]"></i>}
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setIsSelectingForCraft(true)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 mb-4">{t.select_nft}</button>
              <button disabled={selectedForCraft.length < 4 || isCrafting} onClick={runCraft} className="w-full bg-blue-600 py-6 rounded-[32px] font-black shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-20 uppercase tracking-widest">{isCrafting ? t.processing : t.craft}</button>
            </GlassCard>
          </div>
        )}

        {activeTab === Tab.PVP && (
          <div className="animate-in fade-in duration-500 pt-6 flex flex-col items-center">
            <h2 className="text-xl font-black italic mb-8 uppercase tracking-widest">PvP Arena</h2>
            <div className="w-full glass rounded-[48px] p-8 mb-8 text-center border-white/10 flex flex-col items-center overflow-visible">
                <div className="relative w-64 h-64 mb-10 flex-shrink-0">
                    <div className="w-full h-full rounded-full border-8 border-white/5 overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 no-transition">
                            <circle cx="50" cy="50" r="50" fill="#111" />
                            {pvpPlayers.map((p, idx) => {
                                const total = pvpPlayers.reduce((a, b) => a + b.bet, 0);
                                const angle = (p.bet / total) * 360;
                                let offset = 0;
                                for (let i = 0; i < idx; i++) offset += (pvpPlayers[i].bet / total) * 360;
                                return <circle key={p.id} cx="50" cy="50" r="40" fill="none" stroke={p.color} strokeWidth="20" strokeDasharray={`${(angle / 360) * 251.2} 251.2`} strokeDashoffset={`${-(offset / 360) * 251.2}`} />;
                            })}
                        </svg>
                    </div>
                    {/* Slow spin for needle */}
                    <div className={`absolute inset-0 z-20 transition-transform duration-[5s] ease-out`} style={{ transform: `rotate(${pvpRotation}deg)` }}>
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-white clip-path-needle drop-shadow-lg"></div>
                    </div>
                </div>
                
                {pvpStatus === 'countdown' && <div className="text-4xl font-black italic text-blue-500 mb-6 animate-pulse">{pvpTimeLeft}s</div>}
                {pvpWinner && pvpStatus === 'result' && <div className="text-green-400 font-black mb-6 animate-bounce text-lg uppercase tracking-widest">Победитель: {pvpWinner}!</div>}
                
                {/* IMPROVED: Responsive layout for inputs to avoid overlapping */}
                <div className="w-full flex flex-col gap-4 mt-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase opacity-30 tracking-widest text-left ml-2">Ваша Ставка</span>
                    <input type="number" value={pvpBetAmount} onChange={e => setPvpBetAmount(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-[24px] text-center font-black text-xl focus:border-blue-500/50 outline-none" />
                  </div>
                  <button onClick={handlePvpJoin} disabled={pvpStatus !== 'waiting'} className="w-full bg-blue-600 py-6 rounded-[32px] font-black uppercase shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-20 tracking-widest">Играть</button>
                </div>

                {pvpPlayers.length > 0 && (
                  <div className="w-full space-y-3 mt-8">
                    {pvpPlayers.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-4 glass rounded-[24px] border border-white/5">
                        <div className="flex items-center gap-3">
                          <img src={p.avatar} className="w-10 h-10 rounded-full border-2" style={{ borderColor: p.color }} />
                          <div className="text-left">
                            <span className="font-black text-[10px] uppercase opacity-40 block">{p.name === 'Вы' ? 'Вы' : 'Противник'}</span>
                            <span className="font-bold text-xs uppercase" style={{ color: p.color }}>{p.name}</span>
                          </div>
                        </div>
                        <span className="font-black text-blue-400 text-sm">✨ {p.bet}</span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        )}

        {activeTab === Tab.PROFILE && (
          <div className="animate-in slide-in-from-bottom-10 duration-500 flex flex-col items-center pt-16">
            <div className="w-32 h-32 rounded-[48px] glass p-1.5 mb-6 overflow-hidden border-2 border-blue-500/30 shadow-2xl"><img src="https://picsum.photos/seed/user/300" className="w-full h-full object-cover rounded-[44px]" /></div>
            <h2 className="text-2xl font-black italic mb-10 uppercase tracking-tighter opacity-80">GetGifts_User</h2>
            <div className="grid grid-cols-2 gap-4 w-full mb-10 px-2">
              <GlassCard className="p-6 text-center"><span className="text-[10px] opacity-40 uppercase font-black tracking-widest mb-1 block">{t.stars_balance}</span><p className="text-xl font-black text-blue-400 tracking-tighter">✨ {balance}</p></GlassCard>
              <GlassCard className="p-6 text-center"><span className="text-[10px] opacity-40 uppercase font-black tracking-widest mb-1 block">{t.nft_items}</span><p className="text-xl font-black text-purple-400 tracking-tighter">💎 {inventory.length}</p></GlassCard>
            </div>
            <div className="space-y-4 w-full px-2">
              <button onClick={() => setIsInventoryOpen(true)} className="w-full glass p-6 rounded-[32px] flex justify-between items-center group active:scale-[0.98] transition-all"><span className="font-black uppercase text-sm tracking-widest">Мой Инвентарь</span><i className="fa-solid fa-briefcase opacity-20"></i></button>
              <button onClick={() => setIsPromoModalOpen(true)} className="w-full glass p-6 rounded-[32px] flex justify-between items-center group active:scale-[0.98] transition-all"><span className="font-black uppercase text-sm tracking-widest">Промокод</span><i className="fa-solid fa-ticket opacity-20"></i></button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="absolute bottom-0 left-0 right-0 h-24 glass rounded-t-[48px] border-t border-white/10 flex items-center justify-around z-20">
        {[
          { id: Tab.UPGRADE, icon: 'fa-arrow-up', label: t.upgrade },
          { id: Tab.CRAFT, icon: 'fa-tools', label: t.craft },
          { id: Tab.CASES, icon: 'fa-gift', label: t.cases },
          { id: Tab.PVP, icon: 'fa-bolt', label: t.pvp },
          { id: Tab.PROFILE, icon: 'fa-user', label: t.profile },
        ].map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === item.id ? 'text-blue-500 scale-110' : 'text-white/20'}`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${activeTab === item.id ? 'bg-blue-600/10 shadow-lg shadow-blue-500/10' : ''}`}><i className={`fa-solid ${item.icon} text-lg`}></i></div>
            <span className="text-[9px] font-black uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Case Modal */}
      {selectedCase && (
        <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-end animate-in slide-in-from-bottom duration-300">
           <div className="w-full bg-[#0d0d1f] rounded-t-[55px] p-8 max-h-[92vh] overflow-y-auto custom-scrollbar border-t border-white/10 shadow-3xl">
              <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-8"></div>
              <div className="flex justify-between items-center mb-8"><h2 className="text-2xl font-black italic uppercase tracking-tighter">{selectedCase.name}</h2><button onClick={() => setSelectedCase(null)} className="w-10 h-10 rounded-full glass flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity"><i className="fa-solid fa-xmark"></i></button></div>
              <div className="flex flex-col items-center mb-10">
                 <img src={selectedCase.image} className="w-44 h-44 mb-8 drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]" />
                 {selectedCase.type === 'promo' && <div className="w-full mb-6 flex gap-3"><input type="text" value={freePromoInput} onChange={e => setFreePromoInput(e.target.value)} placeholder="FREE" className="flex-1 bg-white/5 border border-white/10 p-5 rounded-[24px] focus:outline-none uppercase font-black text-center tracking-widest" /><button onClick={() => handleOpenCase(selectedCase, 1)} className={`px-10 rounded-[24px] font-black text-xs uppercase tracking-widest transition-all ${freePromoInput.toUpperCase() === 'FREE' ? 'bg-blue-600 shadow-xl shadow-blue-600/30' : 'bg-gray-800 opacity-30 cursor-not-allowed'}`}>{t.enter}</button></div>}
                 {!selectedCase.type && <div className="flex gap-3 mb-8 w-full justify-center">{[1, 2, 3, 4, 5].map(q => (<button key={q} onClick={() => setCaseQty(q)} className={`w-12 h-12 rounded-2xl font-black text-sm border transition-all ${caseQty === q ? 'bg-blue-600 border-blue-400 shadow-xl shadow-blue-600/30' : 'bg-white/5 border-white/10 opacity-30'}`}>{q}</button>))}</div>}
                 <button onClick={() => handleOpenCase(selectedCase, caseQty)} className={`w-full bg-blue-600 py-6 rounded-[32px] font-black text-lg shadow-2xl shadow-blue-600/30 uppercase tracking-widest active:scale-95 ${selectedCase.type === 'promo' && freePromoInput.toUpperCase() !== 'FREE' ? 'hidden' : ''}`}>{t.open} {!selectedCase.type && `(${(selectedCase.price * caseQty).toLocaleString()})`}</button>
              </div>
              <div className="border-t border-white/5 pt-8 pb-4">
                 <h3 className="text-[11px] font-black uppercase opacity-30 mb-6 tracking-[0.2em]">{t.possible_drops}</h3>
                 <div className="grid grid-cols-4 gap-4">{NFT_POOL.filter(n => n.rarity === selectedCase.rarity).slice(0, 16).map(item => <div key={item.id} className={`p-1.5 glass rounded-2xl border ${getRarityClass(item.rarity)} ${inventory.some(i => i.name === item.name) && 'owned-glow'}`}><img src={item.image} className="w-full aspect-square object-cover rounded-xl" /></div>)}</div>
              </div>
           </div>
        </div>
      )}

      {/* Won Items Display - iOS 26 Glass Style Reward Modal */}
      {wonItems.length > 0 && (
        <div className="absolute inset-0 z-[200] bg-black/85 backdrop-blur-[40px] flex flex-col items-center justify-center p-8 text-center animate-in zoom-in duration-500 overflow-hidden">
          {/* Enhanced iOS 26 style background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-transparent to-purple-500/20 opacity-60 pointer-events-none"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>
          
          <div className="flex items-center gap-10 mb-8 z-10">
             {wonItems.length > 1 && <button disabled={currentWonIndex === 0} onClick={() => setCurrentWonIndex(p => p - 1)} className="w-14 h-14 rounded-full glass flex items-center justify-center border-white/20 disabled:opacity-5 active:scale-90 transition-transform"><i className="fa-solid fa-chevron-left"></i></button>}
             <h3 className="text-blue-400 text-[10px] font-black uppercase tracking-[0.6em] animate-pulse">ITEM {currentWonIndex + 1} / {wonItems.length}</h3>
             {wonItems.length > 1 && <button disabled={currentWonIndex === wonItems.length - 1} onClick={() => setCurrentWonIndex(p => p + 1)} className="w-14 h-14 rounded-full glass flex items-center justify-center border-white/20 disabled:opacity-5 active:scale-90 transition-transform"><i className="fa-solid fa-chevron-right"></i></button>}
          </div>

          <div className={`w-80 h-80 glass rounded-[64px] p-2 mb-10 z-10 relative overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.6)] ${getRarityClass(wonItems[currentWonIndex].rarity)}`}>
            <div className={`absolute inset-0 bg-gradient-to-tr opacity-20 pointer-events-none ${wonItems[currentWonIndex].rarity === 'Legendary' ? 'from-orange-500/50' : 'from-blue-500/50'}`}></div>
            <img src={wonItems[currentWonIndex].image} className="w-full h-full object-cover rounded-[58px] relative z-10" />
          </div>

          <div className="z-10">
            <h2 className="text-3xl font-black italic uppercase mb-2 tracking-tighter drop-shadow-md">{wonItems[currentWonIndex].name}</h2>
            <div className={`inline-block px-4 py-1.5 rounded-full mb-10 bg-white/5 border border-white/10`}>
              <span className="text-blue-400 font-black tracking-[0.2em] text-sm">✨ {wonItems[currentWonIndex].value} STARS</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-4 w-full max-w-[300px] z-10 animate-in slide-in-from-bottom duration-500 delay-150">
            <button onClick={() => { setInventory(prev => [...wonItems, ...prev]); setWonItems([]); }} className="w-full bg-white text-black py-6 rounded-[32px] font-black uppercase shadow-2xl tracking-widest active:scale-95 transition-all text-lg">Забрать Всё</button>
            <button onClick={() => sellNFT(wonItems[currentWonIndex])} className="w-full glass py-4 rounded-[28px] text-[10px] font-black text-red-400 uppercase tracking-widest border-red-500/20 active:scale-95 transition-all">Продать за {wonItems[currentWonIndex].value} ✨</button>
          </div>
        </div>
      )}

      {/* Inventory Modal */}
      {isInventoryOpen && (
        <div className="absolute inset-0 z-[120] bg-[#0a0a1a] flex flex-col animate-in slide-in-from-right duration-500">
          <div className="p-6 flex items-center justify-between border-b border-white/5 glass">
            <h2 className="text-lg font-black italic uppercase tracking-widest">Инвентарь ({inventory.length})</h2>
            <div className="flex gap-3"><button onClick={() => setIsSellAllModalOpen(true)} className="bg-red-500/10 text-red-400 px-4 py-2 rounded-xl text-[9px] font-black border border-red-500/20 uppercase tracking-widest">Продать Всё</button><button onClick={() => setIsInventoryOpen(false)} className="w-10 h-10 rounded-full glass flex items-center justify-center border-white/20 active:scale-90 transition-transform"><i className="fa-solid fa-xmark"></i></button></div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div className="grid grid-cols-2 gap-4 pb-12">{sortedInventory.map(item => (<GlassCard key={item.id} className={`p-3 flex flex-col border-2 ${getRarityClass(item.rarity)}`}><img src={item.image} className="w-full aspect-square rounded-2xl object-cover mb-3 shadow-lg" /><p className="text-[10px] font-black truncate uppercase mb-1 opacity-80">{item.name}</p><p className="text-[12px] font-black text-blue-400 mb-4 tracking-tighter">{item.value} ✨</p><button onClick={() => sellNFT(item)} className="w-full bg-red-500/5 text-red-400 py-3 rounded-xl text-[10px] font-black border border-red-500/10 uppercase tracking-widest active:scale-95 transition-all">Продать</button></GlassCard>))}</div>
          </div>
        </div>
      )}

      {isSellAllModalOpen && (
        <div className="absolute inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-10 animate-in fade-in duration-300">
           <div className="w-full glass rounded-[48px] p-10 border-white/20 text-center shadow-3xl">
                <i className="fa-solid fa-coins text-6xl text-yellow-500 mb-8 block drop-shadow-lg"></i>
                <h2 className="text-sm font-black uppercase tracking-widest mb-6 leading-relaxed">{t.sell_all_confirm}</h2>
                <p className="text-4xl font-black text-blue-400 mb-10 tracking-tighter">✨ {inventory.reduce((a, b) => a + (b.value || 0), 0).toLocaleString()}</p>
                <div className="flex gap-4"><button onClick={() => setIsSellAllModalOpen(false)} className="flex-1 glass py-5 rounded-[24px] font-black text-[10px] uppercase opacity-40">Отмена</button><button onClick={sellAllInventory} className="flex-1 bg-red-600 py-5 rounded-[24px] font-black text-[10px] uppercase shadow-xl shadow-red-600/30">Продать</button></div>
           </div>
        </div>
      )}

      {/* Item Selection Modals */}
      {(isSelectingForUpgrade || isSelectingForCraft) && (
        <div className="absolute inset-0 z-[140] bg-[#0a0a1a] p-6 animate-in slide-in-from-right duration-300 flex flex-col">
            <div className="flex justify-between items-center mb-10"><h2 className="text-xl font-black italic uppercase tracking-tighter">Выбор предмета</h2><button onClick={() => { setIsSelectingForUpgrade(false); setIsSelectingForCraft(false); }} className="w-12 h-12 rounded-full glass flex items-center justify-center border-white/20 active:scale-90 transition-transform"><i className="fa-solid fa-check"></i></button></div>
            <div className="grid grid-cols-3 gap-3 overflow-y-auto pb-12 custom-scrollbar">
                {sortedInventory.map(item => {
                    const isSelected = isSelectingForCraft ? !!selectedForCraft.find(s => s.id === item.id) : upgradeNft?.id === item.id;
                    return (<div key={item.id} onClick={() => { 
                        if (isSelectingForCraft) { 
                            if (isSelected) setSelectedForCraft(p => p.filter(s => s.id !== item.id)); 
                            else if (selectedForCraft.length < 12) setSelectedForCraft(p => [...p, item]); 
                        } else { setUpgradeNft(item); setUpgradeTargetNft(null); setIsSelectingForUpgrade(false); } 
                    }} className={`glass rounded-2xl p-2 active:scale-95 transition-all cursor-pointer border-2 ${isSelected ? 'border-blue-500 ring-4 ring-blue-500/20' : getRarityClass(item.rarity)}`}><img src={item.image} className="w-full aspect-square rounded-xl object-cover mb-1.5 shadow-sm" /><div className="text-[10px] text-center font-black text-blue-400">{item.value}</div></div>);
                })}
            </div>
        </div>
      )}

      {isSelectingTargetNft && (
        <div className="absolute inset-0 z-[140] bg-[#0a0a1a] p-6 animate-in slide-in-from-right duration-300 flex flex-col">
            <div className="flex justify-between items-center mb-10"><h2 className="text-xl font-black italic uppercase tracking-tighter">Выбор приза</h2><button onClick={() => setIsSelectingTargetNft(false)} className="w-12 h-12 rounded-full glass flex items-center justify-center border-white/20 active:scale-90 transition-transform"><i className="fa-solid fa-xmark"></i></button></div>
            <div className="grid grid-cols-3 gap-3 overflow-y-auto pb-12 custom-scrollbar">
                {NFT_POOL.filter(i => upgradeNft && i.value! >= upgradeNft.value! * 1.67).sort((a,b) => a.value! - b.value!).map(item => (
                    <div key={item.id} onClick={() => { setUpgradeTargetNft(item); setIsSelectingTargetNft(false); }} className={`glass rounded-2xl p-2 active:scale-95 transition-all cursor-pointer border-2 ${getRarityClass(item.rarity)}`}>
                        <img src={item.image} className="w-full aspect-square rounded-xl object-cover mb-1.5 shadow-sm" />
                        <div className="text-[10px] text-center font-black text-green-400">{Math.round((upgradeNft!.value! / item.value!) * 100)}%</div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* Recharge & Promo Modals */}
      {isRechargeModalOpen && (
        <div className="absolute inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-end animate-in slide-in-from-bottom duration-300">
          <div className="w-full bg-[#0d0d1f] rounded-t-[55px] p-10 border-t border-white/10 shadow-3xl">
            <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-10"></div>
            <div className="flex justify-between items-center mb-10"><h2 className="text-2xl font-black italic uppercase tracking-tighter">{t.recharge}</h2><button onClick={() => setIsRechargeModalOpen(false)} className="opacity-40 hover:opacity-100 active:scale-90 transition-transform"><i className="fa-solid fa-xmark text-xl"></i></button></div>
            <input type="number" value={tonAmount} onChange={e => setTonAmount(e.target.value)} placeholder="0.00 TON" className="w-full bg-white/5 border border-white/10 p-8 rounded-[32px] mb-10 focus:outline-none focus:border-blue-500 font-black text-3xl tracking-tighter text-center" />
            <button disabled={isProcessingTx} onClick={handleTonRecharge} className="w-full bg-blue-600 py-6 rounded-[32px] font-black text-xl shadow-2xl shadow-blue-600/30 active:scale-95 uppercase tracking-widest transition-all">{isProcessingTx ? <i className="fa-solid fa-spinner animate-spin"></i> : (isWalletConnected ? 'Пополнить' : 'Кошелек')}</button>
          </div>
        </div>
      )}

      {isPromoModalOpen && (
        <div className="absolute inset-0 z-[160] bg-black/80 backdrop-blur-md flex items-center justify-center p-10 animate-in zoom-in duration-300">
          <div className="w-full glass rounded-[55px] p-10 border-white/10 text-center shadow-3xl">
            <i className="fa-solid fa-ticket text-6xl text-orange-400 mb-8 block drop-shadow-md"></i>
            <h2 className="text-lg font-black italic mb-8 uppercase tracking-[0.2em]">{t.promo_code}</h2>
            <input id="pInput" type="text" placeholder="GIFT CODE" className="w-full bg-white/5 border border-white/10 p-6 rounded-[28px] mb-8 focus:outline-none uppercase font-black text-center tracking-[0.3em] caret-blue-500" />
            <div className="flex gap-4"><button onClick={() => setIsPromoModalOpen(false)} className="flex-1 glass py-5 rounded-[24px] font-black text-[10px] uppercase opacity-40 active:scale-95 transition-all">Назад</button><button onClick={() => {
                const code = (document.getElementById('pInput') as HTMLInputElement).value.toUpperCase();
                const promo = PROMO_CODES.find(p => p.code === code);
                if (promo) { setBalance(p => p + promo.reward); alert(`Код активирован! +${promo.reward} STARS`); setIsPromoModalOpen(false); } else alert(t.promo_err);
            }} className="flex-[2] bg-blue-600 py-5 rounded-[24px] font-black text-[10px] uppercase shadow-xl shadow-blue-600/30 active:scale-95 transition-all">Активировать</button></div>
          </div>
        </div>
      )}

      {isOpeningCase && <div className="absolute inset-0 z-[300] bg-[#0a0a1a]/95 backdrop-blur-2xl flex flex-col items-center justify-center animate-in fade-in duration-300"><div className="relative mb-12"><div className="absolute inset-0 bg-blue-600/20 rounded-full blur-3xl animate-pulse"></div><img src="https://iili.io/fMg77LB.png" className="w-40 h-40 animate-bounce relative z-10" /></div><p className="text-xl font-black italic tracking-[0.3em] text-blue-400 uppercase animate-pulse">Открываем...</p></div>}
    </div>
  );
};

export default App;
