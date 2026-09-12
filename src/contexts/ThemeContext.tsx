
import React, { createContext, useContext, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCompany, updateCompany } from "@/lib/api";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { useToast } from "@/components/ui/use-toast";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => { },
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>("light");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch the company settings to get the dark mode preference
  const { data: company } = useQuery({
    queryKey: ["company", getPersistentCompanyId()],
    queryFn: () => getCompany(getPersistentCompanyId()),
  });

  // Update company settings when dark mode is toggled
  const { mutate } = useMutation({
    mutationFn: (darkMode: boolean) => updateCompany(getPersistentCompanyId(), { dark_mode: darkMode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", getPersistentCompanyId()] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el modo oscuro",
        variant: "destructive",
      });
    }
  });

  // Effect to update theme based on storage and company settings
  useEffect(() => {
    const savedTheme = localStorage.getItem("ccdt-theme-preference") as Theme | null;

    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else if (company) {
      const prefersDark = company.dark_mode;
      const defaultTheme = prefersDark ? "dark" : "light";
      setTheme(defaultTheme);

      if (prefersDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, [company]);

  // Function to toggle theme
  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("ccdt-theme-preference", newTheme);

    // Toggle dark class on document
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // NOT updating company settings anymore to allow individual preference
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
