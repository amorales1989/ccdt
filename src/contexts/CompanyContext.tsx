import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

interface CompanyContextType {
    companyId: number;
    setCompanyId: (id: number) => void;
    isLoading: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [companyId, setCompanyIdState] = useState<number>(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // 1. Intentar obtener de URL
        const urlId = searchParams.get('companyId');

        if (urlId) {
            const parsedId = parseInt(urlId, 10);
            if (!isNaN(parsedId)) {
                setCompanyIdState(parsedId);
                localStorage.setItem('ccdt_company_id', parsedId.toString());
                setIsLoading(false);
                return;
            }
        }

        // 2. Intentar obtener de localStorage
        const savedId = localStorage.getItem('ccdt_company_id');
        if (savedId) {
            const parsedSavedId = parseInt(savedId, 10);
            if (!isNaN(parsedSavedId)) {
                setCompanyIdState(parsedSavedId);
            }
        }

        setIsLoading(false);
    }, [searchParams]);

    const setCompanyId = (id: number) => {
        setCompanyIdState(id);
        localStorage.setItem('ccdt_company_id', id.toString());

        // Opcional: Actualizar URL
        const newParams = new URLSearchParams(searchParams);
        newParams.set('companyId', id.toString());
        setSearchParams(newParams);
    };

    return (
        <CompanyContext.Provider value={{ companyId, setCompanyId, isLoading }}>
            {children}
        </CompanyContext.Provider>
    );
};

export const useCompany = () => {
    const context = useContext(CompanyContext);
    if (context === undefined) {
        throw new Error('useCompany must be used within a CompanyProvider');
    }
    return context;
};

/**
 * Helper para obtener el companyId fuera de componentes de React (ej. lib/api.ts)
 */
export const getPersistentCompanyId = (): number => {
    if (typeof window === 'undefined') return 1;

    // 1. Mirar URL primero
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get('companyId');
    if (urlId) {
        const parsed = parseInt(urlId, 10);
        if (!isNaN(parsed)) return parsed;
    }

    // 2. Mirar localStorage
    const savedId = localStorage.getItem('ccdt_company_id');
    if (savedId) {
        const parsedSavedId = parseInt(savedId, 10);
        if (!isNaN(parsedSavedId)) return parsedSavedId;
    }

    return 1;
};
