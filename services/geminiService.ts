import { User, Investment, Transaction, BudgetCategory, Loan, TransactionType, Insurance } from "../types";
import type { PortfolioAudit, BudgetAudit } from "./ruleEngine";
import { apiFetch, AIError, notifyAI } from "./api";
import {
    analyzePortfolioLocal, analyzeBudgetLocal, getPriorityActionLocal, getLifeLevelUpLocal,
    parseSmsLocal,
} from "./ruleEngine";

// Local (no-network) analysis lives in ruleEngine.ts. Only statement import, voice entry and chat still use AI.
export type { PortfolioAudit, BudgetAudit } from "./ruleEngine";


const callServerAI = async (action: string, ...args: any[]): Promise<any> => {
    const response = await apiFetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, args })
    });
    const data = await response.json();
    return data.result;
};

/** Tell the user why an AI feature did not work (signed out, offline, limit reached) instead of failing silently. */
const reportAIError = (e: unknown, action: string) => {
    console.error(`AI request failed [${action}]:`, e);
    if (e instanceof AIError) notifyAI(e.message);
    else notifyAI("Something went wrong with the AI service. Please try again.");
};

export const analyzePortfolio = async (investments: Investment[], lang?: string): Promise<PortfolioAudit | string> => {
    return analyzePortfolioLocal(investments, lang);
};

export const analyzeBudget = async (budgets: BudgetCategory[], transactions: Transaction[], lang?: string): Promise<BudgetAudit | string> => {
    return analyzeBudgetLocal(budgets, transactions, lang);
};

export const parseVoiceTransaction = async (audioBase64: string): Promise<{amount: number, category: string, description: string} | null> => {
    try {
        return await callServerAI("parseVoiceTransaction", audioBase64);
    } catch (e) {
        reportAIError(e, "parseVoiceTransaction");
        return null;
    }
};

export const extractStatementTransactions = async (fileBase64: string, mimeType: string): Promise<Transaction[]> => {
    try {
        return await callServerAI("extractStatementTransactions", fileBase64, mimeType);
    } catch (e) {
        reportAIError(e, "extractStatementTransactions");
        return [];
    }
};

export const extractMutualFundInvestments = async (fileBase64: string, mimeType: string): Promise<Investment[]> => {
    try {
        return await callServerAI("extractMutualFundInvestments", fileBase64, mimeType);
    } catch (e) {
        reportAIError(e, "extractMutualFundInvestments");
        return [];
    }
};

export const parseSmsTransaction = async (smsText: string): Promise<Partial<Transaction> | null> => {
    // On-device only: raw SMS text (balances, account numbers) never leaves the phone.
    return parseSmsLocal(smsText);
};

export const parsePdfStatement = async (text: string): Promise<Omit<Investment, 'id'>[]> => {
    try {
        return await callServerAI("parsePdfStatement", text);
    } catch (e) {
        reportAIError(e, "parsePdfStatement");
        return [];
    }
};

export const getFinancialAdvice = async (
    query: string, 
    context: { investments: Investment[], budgets: BudgetCategory[], loans: Loan[] },
    lang?: string
): Promise<string> => {
    try {
        return await callServerAI("getFinancialAdvice", query, context, lang);
    } catch (e) {
        console.error("AI chat failed:", e);
        if (e instanceof AIError && e.code === 'sign-in-required') return lang === 'hi' ? "AI सहायक का उपयोग करने के लिए साइन इन करें।" : "Sign in to chat with the AI assistant. It isn't available in Guest Mode.";
        if (e instanceof AIError && e.code === 'rate-limited') return lang === 'hi' ? "बहुत सारे अनुरोध। कृपया एक मिनट बाद पुनः प्रयास करें।" : "That's a lot of questions at once. Give it a minute and try again.";
        if (e instanceof AIError && e.code === 'not-configured') return lang === 'hi' ? "AI सहायक इस ऐप संस्करण में अभी उपलब्ध नहीं है।" : "The AI assistant isn't available in this version of the app yet.";
        if (e instanceof AIError && e.code === 'network') return lang === 'hi' ? "इंटरनेट कनेक्शन नहीं मिला। कृपया जाँचें और फिर प्रयास करें।" : "I can't reach the internet right now. Check your connection and try again.";
        return lang === 'hi' ? "मैं अभी ऑफलाइन हूँ। कृपया कुछ मिनटों बाद फिर से प्रयास करें।" : "AI is offline right now. Please try again shortly.";
    }
};

export const getPriorityAction = async (context: { 
    investments: Investment[], 
    budgets: BudgetCategory[], 
    loans: Loan[],
    goals: any[]
}, lang?: string): Promise<{ title: string, description: string, type: 'danger' | 'warning' | 'success' | 'info' } | null> => {
    return getPriorityActionLocal(context, lang);
};

// Live index values need a licensed market-data source; an LLM must not invent them.
// Returns null until a real quote provider is wired in (the dashboard handles null).
export const getMarketPulse = async (): Promise<{nifty: number, niftyChange: number, sensex: number, sensexChange: number, prediction: string} | null> => {
    return null;
};

// Prices must come from a data API (AMFI NAV for funds, a quote provider for stocks), not from an LLM.
export const syncMarketPrices = async (_investments: Investment[]): Promise<{ id: string, currentValue: number, benchmarkName?: string, benchmarkReturn?: number, annualizedReturn?: number }[]> => {
    return [];
};

export const getLifeLevelUpAdvice = async (context: { 
    investments: Investment[], 
    budgets: BudgetCategory[], 
    loans: Loan[],
    insurance: Insurance[],
    netWorth: number,
    safetyNetMonths: number
}, lang?: string): Promise<{ 
    currentLevel: string, 
    nextLevel: string, 
    progress: number, 
    requirements: string[], 
    aiAdvice: string,
    badgeColor: string
} | null> => {
    return getLifeLevelUpLocal(context, lang);
};
