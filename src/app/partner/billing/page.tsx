'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface QuotaMetric {
  monthlyQuota?: number;
  purchased?: number;
  quotaGB?: number;
  used?: number;
  usedGB?: number;
  remaining?: number;
  remainingGB?: number;
  utilizationPercent: number;
  overage?: number;
  overageGB?: number;
}

interface SubscriptionData {
  subscriptionId: string;
  instituteId: string;
  planTier: string;
  billingCycle: string;
  status: string;
  pricePerMonthCents: number;
  priceFormatted: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  seats: QuotaMetric;
  voiceMinutes: QuotaMetric;
  candidateEvaluations: QuotaMetric;
  videoStorage: QuotaMetric;
}

interface InvoiceSummary {
  invoiceId: string;
  invoiceNumber: string;
  billingPeriod: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  totalFormatted: string;
  status: string;
  pdfStorageUrl: string;
  createdAt: string;
}

interface LineItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

interface DetailedInvoice {
  invoiceId: string;
  invoiceNumber: string;
  billingPeriod: string;
  subtotalFormatted: string;
  taxFormatted: string;
  totalFormatted: string;
  status: string;
  pdfStorageUrl: string;
  lineItems: LineItem[];
  createdAt: string;
}

export default function PartnerBillingPage() {
  const [loading, setLoading] = useState(true);
  const [subData, setSubData] = useState<SubscriptionData | null>(null);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<DetailedInvoice | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [selectedTier, setSelectedTier] = useState('UniversityEnterprise');
  const [selectedCycle, setSelectedCycle] = useState('Monthly');
  const [notice, setNotice] = useState<string | null>(null);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const [subRes, invRes] = await Promise.all([
        fetch('http://localhost:5000/api/billing/enterprise/subscription'),
        fetch('http://localhost:5000/api/billing/enterprise/invoices')
      ]);

      if (subRes.ok) {
        const data = await subRes.json();
        setSubData(data);
        setSelectedTier(data.planTier);
        setSelectedCycle(data.billingCycle);
      }

      if (invRes.ok) {
        const invList = await invRes.json();
        setInvoices(invList);
      }
    } catch (err) {
      console.error('Failed to load partner billing data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  const handleUpdatePlan = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/billing/enterprise/subscription/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planTier: selectedTier,
          billingCycle: selectedCycle,
          seats: selectedTier === 'CorporateScale' ? 100 : selectedTier === 'CorporateCustom' ? 250 : 50
        })
      });

      if (res.ok) {
        setNotice(`Plan successfully updated to ${selectedTier} (${selectedCycle}).`);
        setIsUpgrading(false);
        fetchBillingData();
        setTimeout(() => setNotice(null), 5000);
      }
    } catch (err) {
      console.error('Failed to update plan', err);
    }
  };

  const handleGenerateInvoice = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/billing/enterprise/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingPeriod: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        })
      });

      if (res.ok) {
        const newInv = await res.json();
        setNotice(`Generated invoice ${newInv.invoiceNumber} for ${newInv.totalFormatted}.`);
        fetchBillingData();
        setTimeout(() => setNotice(null), 5000);
      }
    } catch (err) {
      console.error('Failed to generate invoice', err);
    }
  };

  const handleViewInvoice = async (invoiceId: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/billing/enterprise/invoices/${invoiceId}`);
      if (res.ok) {
        const detailed = await res.json();
        setSelectedInvoice(detailed);
      }
    } catch (err) {
      console.error('Failed to load invoice detail', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-mono text-sm">Loading Enterprise Usage &amp; Billing Ledger...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link
            href="/partner/dashboard"
            className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition"
          >
            &larr; Back to Dashboard
          </Link>
          <div className="h-4 w-[1px] bg-slate-700"></div>
          <h1 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            Enterprise Multi-Tenant Billing &amp; Usage Meter
          </h1>
          <span className="text-xs px-2 py-0.5 rounded font-mono bg-indigo-950 text-indigo-300 border border-indigo-700/50">
            {subData?.planTier}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {notice && (
            <span className="text-xs text-emerald-400 font-mono bg-emerald-950/60 px-3 py-1 rounded border border-emerald-800/40 animate-fade-in">
              {notice}
            </span>
          )}
          <button
            onClick={handleGenerateInvoice}
            className="px-3 py-1.5 rounded text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            Generate Statement
          </button>
          <button
            onClick={() => setIsUpgrading(true)}
            className="px-3.5 py-1.5 rounded text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
          >
            Change Plan &amp; Seats
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Plan Overview Card */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                {subData?.status}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Cycle: {subData?.billingCycle}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white mt-1">
              {subData?.planTier} Tier
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Current Period: {new Date(subData?.currentPeriodStart || '').toLocaleDateString()} &mdash; {new Date(subData?.currentPeriodEnd || '').toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-white tracking-tight">
              {subData?.priceFormatted}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              (Includes All Quotas)
            </span>
          </div>
        </div>

        {/* 4 Usage Metering Gauges */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Seats */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
                <span>Active Seats</span>
                <span className="text-indigo-400 font-semibold">{subData?.seats.utilizationPercent}%</span>
              </div>
              <div className="text-2xl font-bold text-white mb-2">
                {subData?.seats.used} <span className="text-xs text-slate-500 font-normal">/ {subData?.seats.purchased} Seats</span>
              </div>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, subData?.seats.utilizationPercent || 0)}%` }}
              ></div>
            </div>
          </div>

          {/* 2. Voice Minutes */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
                <span>Voice AI Quota</span>
                <span className="text-cyan-400 font-semibold">{subData?.voiceMinutes.utilizationPercent}%</span>
              </div>
              <div className="text-2xl font-bold text-white mb-2">
                {subData?.voiceMinutes.used} <span className="text-xs text-slate-500 font-normal">/ {subData?.voiceMinutes.monthlyQuota} Mins</span>
              </div>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-cyan-500 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, subData?.voiceMinutes.utilizationPercent || 0)}%` }}
              ></div>
            </div>
          </div>

          {/* 3. Candidate Evaluations */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
                <span>Candidate Evals</span>
                <span className="text-emerald-400 font-semibold">{subData?.candidateEvaluations.utilizationPercent}%</span>
              </div>
              <div className="text-2xl font-bold text-white mb-2">
                {subData?.candidateEvaluations.used} <span className="text-xs text-slate-500 font-normal">/ {subData?.candidateEvaluations.monthlyQuota} Runs</span>
              </div>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, subData?.candidateEvaluations.utilizationPercent || 0)}%` }}
              ></div>
            </div>
          </div>

          {/* 4. Video Storage */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
                <span>Proctor Video Storage</span>
                <span className="text-amber-400 font-semibold">{subData?.videoStorage.utilizationPercent}%</span>
              </div>
              <div className="text-2xl font-bold text-white mb-2">
                {subData?.videoStorage.usedGB} <span className="text-xs text-slate-500 font-normal">/ {subData?.videoStorage.quotaGB} GB</span>
              </div>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, subData?.videoStorage.utilizationPercent || 0)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Invoices & Statements Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">Invoices &amp; Billing Statements</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Automated monthly statements with itemized usage overage breakdowns.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {invoices.length} Total Statements
            </span>
          </div>

          {invoices.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-lg">
              <p className="text-sm text-slate-400 font-mono">No invoices generated yet.</p>
              <button
                onClick={handleGenerateInvoice}
                className="mt-3 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded transition"
              >
                Generate First Statement
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-semibold">Invoice #</th>
                    <th className="pb-3 font-semibold">Billing Period</th>
                    <th className="pb-3 font-semibold">Issue Date</th>
                    <th className="pb-3 font-semibold">Amount</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {invoices.map((inv) => (
                    <tr key={inv.invoiceId} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 font-bold text-white">{inv.invoiceNumber}</td>
                      <td className="py-3 text-slate-300">{inv.billingPeriod}</td>
                      <td className="py-3 text-slate-400">{new Date(inv.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 text-emerald-400 font-bold">{inv.totalFormatted}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 text-right space-x-2">
                        <button
                          onClick={() => handleViewInvoice(inv.invoiceId)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-400 font-medium transition"
                        >
                          View Line Items
                        </button>
                        <a
                          href={inv.pdfStorageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
                        >
                          PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Upgrade / Plan Change Modal */}
      {isUpgrading && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Upgrade or Change Subscription Plan</h3>
              <button
                onClick={() => setIsUpgrading(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-mono block mb-1">Select Tier</label>
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white font-mono focus:border-indigo-500 outline-none"
                >
                  <option value="UniversityStandard">University Standard ($249/mo - 20 Seats, 1k Mins)</option>
                  <option value="UniversityEnterprise">University Enterprise ($499/mo - 50 Seats, 2.5k Mins)</option>
                  <option value="CorporateScale">Corporate Scale ($999/mo - 100 Seats, 6k Mins)</option>
                  <option value="CorporateCustom">Corporate Custom ($1,999/mo - 250 Seats, 15k Mins)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-mono block mb-1">Billing Frequency</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedCycle('Monthly')}
                    className={`py-2 rounded-lg text-xs font-mono border transition ${
                      selectedCycle === 'Monthly'
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Monthly Billing
                  </button>
                  <button
                    onClick={() => setSelectedCycle('Annual')}
                    className={`py-2 rounded-lg text-xs font-mono border transition ${
                      selectedCycle === 'Annual'
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Annual (20% Off)
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsUpgrading(false)}
                className="px-3 py-1.5 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePlan}
                className="px-4 py-1.5 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white shadow"
              >
                Confirm Plan Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">{selectedInvoice.invoiceNumber}</h3>
                <p className="text-xs text-slate-400 font-mono">{selectedInvoice.billingPeriod}</p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {selectedInvoice.lineItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded bg-slate-950 border border-slate-800/80 text-xs font-mono">
                  <div>
                    <p className="text-slate-200 font-medium">{item.description}</p>
                    <p className="text-slate-500 text-[10px]">Qty: {item.quantity}</p>
                  </div>
                  <span className="text-white font-bold">${(item.totalCents / 100.0).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-800 pt-3 space-y-1 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span>{selectedInvoice.subtotalFormatted}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Estimated Tax (8%):</span>
                <span>{selectedInvoice.taxFormatted}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-emerald-400 pt-1 border-t border-slate-800/60">
                <span>Total Due:</span>
                <span>{selectedInvoice.totalFormatted}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-1.5 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
