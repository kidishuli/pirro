'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface Transaction {
  id: string;
  recipient: string;
  recipientSub: string;
  amount: number;
  type: 'debit' | 'credit';
  date: string;
  time: string;
  transactionNumber: string;
  logo?: string;
  status: string;
}

export interface MerchantPayment {
  id: string;
  ref: string;
  time: string;
  fullDate: string;
  amount: number;
}

interface DbTransactionRow {
  id: string;
  sender_handle: string;
  receiver_handle: string;
  amount_p: number;
  reference_code: string;
  status: string;
  created_at: string;
}

function mapDbTxToTransaction(row: DbTransactionRow): Transaction {
  const isCredit = row.receiver_handle === '@alkid';
  const createdAt = new Date(row.created_at);
  const isToday = new Date().toDateString() === createdAt.toDateString();
  const dateStr = isToday
    ? 'Sot'
    : createdAt.toLocaleDateString('sq-AL', { weekday: 'long' });
  const timeStr = createdAt.toLocaleTimeString('sq-AL', {
    hour: '2-digit',
    minute: '2-digit',
  });

  let recipient = 'Banka Kombëtare Tregtare';
  let recipientSub = 'karta e debitit BKT 4667';
  let logo: string | undefined = '/assets/logos/mastercard logo.png';

  if (!isCredit) {
    if (row.receiver_handle === '@laguna' || row.receiver_handle.toLowerCase().includes('laguna')) {
      recipient = 'Laguna';
      recipientSub = 'Blerje';
      logo = '/assets/logos/laguna logo.png';
    } else {
      recipient = row.receiver_handle;
      recipientSub = 'Blerje';
      logo = '/assets/logos/laguna logo.png';
    }
  } else {
    recipient = 'Shto para nga BKT';
    recipientSub = 'karta e debitit BKT 4667';
  }

  return {
    id: row.id,
    recipient,
    recipientSub,
    amount: Number(row.amount_p),
    type: isCredit ? 'credit' : 'debit',
    date: dateStr,
    time: timeStr,
    transactionNumber: row.reference_code || `${Math.floor(10000000000000000 + Math.random() * 90000000000000000)}`,
    logo,
    status: row.status === 'COMPLETED' ? 'Kryer' : row.status,
  };
}

interface PirroContextType {
  balance: number;
  isDormant: boolean;
  toggleDormant: () => void;
  showBalance: boolean;
  setShowBalance: (show: boolean) => void;
  transactions: Transaction[];
  addFunds: (amount: number) => Promise<void> | void;
  payMerchant: (amount: number, recipient: string, logo?: string) => Transaction;
  formatPirro: (amount: number) => string;
  merchantPayments: MerchantPayment[];
  collectMerchantPayment: (amount: number) => MerchantPayment;
  merchantTotalVolume: number;
  merchantTodayCount: number;
  merchantSavings: number;
}

const PirroContext = createContext<PirroContextType | undefined>(undefined);

const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1',
    recipient: 'Cineplexx AL',
    recipientSub: 'Blerje',
    amount: 1550,
    type: 'debit',
    date: 'E mërkurë',
    time: '20:15',
    transactionNumber: '92837482910482918',
    logo: '/assets/logos/cineplexx logo.png',
    status: 'Kryer',
  },
  {
    id: 'tx-2',
    recipient: 'Banka Kombëtare Tregtare',
    recipientSub: 'Para të shtuara',
    amount: 5000,
    type: 'credit',
    date: 'E martë',
    time: '11:30',
    transactionNumber: '87836329437294821',
    status: 'Kryer',
  },
];

export function PirroProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = useState(3450);
  const [isDormant, setIsDormant] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);

  const BASE_BALANCE = 3450;

  const loadData = useCallback(async () => {
    try {
      const { data: dbTxs, error } = await supabase
        .from('transactions')
        .select('*')
        .or('sender_handle.eq.@alkid,receiver_handle.eq.@alkid')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching initial data from Supabase:', error);
        return;
      }

      const rows = (dbTxs || []) as DbTransactionRow[];

      // Calculate net change strictly from ledger transactions
      const netChange = rows.reduce((acc, tx) => {
        const amt = Number(tx.amount_p) || 0;
        if (tx.receiver_handle === '@alkid') return acc + amt;
        if (tx.sender_handle === '@alkid') return acc - amt;
        return acc;
      }, 0);

      const calculatedBalance = Math.max(0, BASE_BALANCE + netChange);
      setBalance(calculatedBalance);

      // Map DB transactions and append base initial transactions
      const mappedTxs = rows.map(mapDbTxToTransaction);
      setTransactions([...mappedTxs, ...INITIAL_TRANSACTIONS]);

      // Keep profiles.balance_p updated in Supabase to maintain database consistency
      await supabase
        .from('profiles')
        .update({ balance_p: calculatedBalance, last_active_at: new Date().toISOString() })
        .eq('handle', '@alkid');
    } catch (err) {
      console.error('Error loading data from Supabase:', err);
    }
  }, []);

  // Sync initial balance & transactions from Supabase, and listen for realtime updates
  useEffect(() => {
    loadData();

    // Realtime subscription: profile balance updates
    const profileChannel = supabase
      .channel('realtime_alkid_balance')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: 'handle=eq.@alkid',
        },
        (payload) => {
          if (payload.new && 'balance_p' in payload.new && typeof payload.new.balance_p === 'number') {
            setBalance(payload.new.balance_p);
          }
        }
      )
      .subscribe();

    // Realtime subscription: transactions changes (INSERT, UPDATE, DELETE)
    const txChannel = supabase
      .channel('realtime_transactions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
        },
        async () => {
          await loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(txChannel);
    };
  }, [loadData]);

  // Toggle dormant state (Day 0 vs Day 180+)
  const toggleDormant = () => {
    setIsDormant((prev) => !prev);
  };

  const addFunds = async (amount: number) => {
    const refCode = 'TOPUP-' + Math.floor(100000 + Math.random() * 900000);
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      recipient: 'Shto para nga BKT',
      recipientSub: 'karta e debitit BKT 4667',
      amount: amount,
      type: 'credit',
      date: 'Sot',
      time: new Date().toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' }),
      transactionNumber: refCode,
      logo: '/assets/logos/mastercard logo.png',
      status: 'Kryer',
    };

    setBalance((prev) => prev + amount);
    setTransactions((prev) => [newTx, ...prev]);

    try {
      const { error: txError } = await supabase.from('transactions').insert({
        sender_handle: '@bkt',
        receiver_handle: '@alkid',
        amount_p: amount,
        reference_code: refCode,
        status: 'COMPLETED',
      });

      if (txError) {
        console.error('Gabim gjatë rimbushjes:', txError);
      }

      await loadData();
    } catch (err) {
      console.error('Error syncing addFunds to Supabase:', err);
    }
  };

  const payMerchant = (amount: number, recipient: string, logo?: string): Transaction => {
    const refCode = `PAY-${Math.floor(100000 + Math.random() * 900000)}`;
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      recipient,
      recipientSub: 'Blerje',
      amount,
      type: 'debit',
      date: 'Sot',
      time: new Date().toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' }),
      transactionNumber: refCode,
      logo: logo || '/assets/logos/laguna logo.png',
      status: 'Kryer',
    };

    setBalance((prev) => Math.max(0, prev - amount));
    setTransactions((prev) => [newTx, ...prev]);

    (async () => {
      try {
        const receiverHandle = recipient.startsWith('@')
          ? recipient
          : `@${recipient.toLowerCase().replace(/\s+/g, '')}`;

        // 1. Insert into transactions ledger
        await supabase.from('transactions').insert({
          sender_handle: '@alkid',
          receiver_handle: receiverHandle,
          amount_p: amount,
          reference_code: refCode,
          status: 'COMPLETED',
        });

        // 2. Increment merchant profile balance
        const { data: merchantProfile } = await supabase
          .from('profiles')
          .select('balance_p')
          .eq('handle', receiverHandle)
          .single();

        if (merchantProfile) {
          await supabase
            .from('profiles')
            .update({
              balance_p: (merchantProfile.balance_p || 0) + amount,
              last_active_at: new Date().toISOString(),
            })
            .eq('handle', receiverHandle);
        }

        // 3. Confirm and sync ledger balance
        await loadData();
      } catch (err) {
        console.error('Error syncing payMerchant to Supabase:', err);
      }
    })();

    return newTx;
  };

  // Merchant payments state
  const [merchantPayments, setMerchantPayments] = useState<MerchantPayment[]>([
    { id: '1', ref: 'PX-84920', time: 'Sot, 14:32', fullDate: '17 Shtator 2026', amount: 5000 },
    { id: '2', ref: 'PX-84919', time: 'Sot, 14:15', fullDate: '17 Shtator 2026', amount: 1200 },
    { id: '3', ref: 'PX-84918', time: 'Sot, 13:50', fullDate: '17 Shtator 2026', amount: 350 },
    { id: '4', ref: 'PX-84917', time: 'Sot, 13:20', fullDate: '17 Shtator 2026', amount: 2400 },
    { id: '5', ref: 'PX-84916', time: 'Sot, 12:45', fullDate: '17 Shtator 2026', amount: 150 },
    { id: '6', ref: 'PX-84915', time: 'Sot, 11:10', fullDate: '17 Shtator 2026', amount: 9350 },
  ]);

  const merchantTotalVolume = merchantPayments.reduce((sum, p) => sum + p.amount, 0);
  const merchantTodayCount = 38 + (merchantPayments.length - 6);
  const merchantSavings = Math.round(merchantTotalVolume * 0.025);

  const collectMerchantPayment = (amount: number): MerchantPayment => {
    const now = new Date();
    const timeStr = `Sot, ${now.toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' })}`;
    const randomRefNum = Math.floor(10000 + Math.random() * 90000);
    const refCode = `PX-${randomRefNum}`;
    const newPayment: MerchantPayment = {
      id: `mp-${Date.now()}`,
      ref: refCode,
      time: timeStr,
      fullDate: '17 Shtator 2026',
      amount,
    };
    setMerchantPayments((prev) => [newPayment, ...prev]);

    (async () => {
      try {
        // 1. Decrement @alkid balance
        const { data: alkidProfile } = await supabase
          .from('profiles')
          .select('balance_p')
          .eq('handle', '@alkid')
          .single();

        if (alkidProfile) {
          await supabase
            .from('profiles')
            .update({
              balance_p: Math.max(0, (alkidProfile.balance_p || 0) - amount),
              last_active_at: new Date().toISOString(),
            })
            .eq('handle', '@alkid');
        }

        // 2. Increment @laguna balance
        const { data: lagunaProfile } = await supabase
          .from('profiles')
          .select('balance_p')
          .eq('handle', '@laguna')
          .single();

        if (lagunaProfile) {
          await supabase
            .from('profiles')
            .update({
              balance_p: (lagunaProfile.balance_p || 0) + amount,
              last_active_at: new Date().toISOString(),
            })
            .eq('handle', '@laguna');
        }

        // 3. Insert transaction
        await supabase.from('transactions').insert({
          sender_handle: '@alkid',
          receiver_handle: '@laguna',
          amount_p: amount,
          reference_code: refCode,
          status: 'COMPLETED',
        });
      } catch (err) {
        console.error('Error syncing collectMerchantPayment to Supabase:', err);
      }
    })();

    return newPayment;
  };

  const formatPirro = (amt: number) => {
    return amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <PirroContext.Provider
      value={{
        balance,
        isDormant,
        toggleDormant,
        showBalance,
        setShowBalance,
        transactions,
        addFunds,
        payMerchant,
        formatPirro,
        merchantPayments,
        collectMerchantPayment,
        merchantTotalVolume,
        merchantTodayCount,
        merchantSavings,
      }}
    >
      {children}
    </PirroContext.Provider>
  );
}

export function usePirro() {
  const context = useContext(PirroContext);
  if (!context) {
    throw new Error('usePirro must be used within a PirroProvider');
  }
  return context;
}
