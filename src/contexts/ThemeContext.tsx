
import React, { createContext, useContext, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCompany, updateCompany } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>("light");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch the company settings to get the dark mode preference
  const { data: company } = useQuery({
    queryKey: ["company"],
    queryFn: () => getCompany(1),
    // Add error handling and retry configuration
    retry: 1,
    retryDelay: 1000,
    onError: (error) => {
      console.error("Failed to fetch company settings:", error);
      // Apply default theme if we can't get company settings
      document.documentElement.classList.remove("dark");
    }
  });

  // Update company settings when dark mode is toggled
  const { mutate } = useMutation({
    mutationFn: (darkMode: boolean) => updateCompany(1, { dark_mode: darkMode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
    },
    onError: (error) => {
      console.error("Failed to update theme setting:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el modo oscuro",
        variant: "destructive",
      });
    }
  });

  // Effect to update theme based on company settings
  useEffect(() => {
    if (company) {
      const prefersDark = company.dark_mode;
      setTheme(prefersDark ? "dark" : "light");
      
      // Apply theme to document
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
    
    // Toggle dark class on document
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    
    // Update company settings
    mutate(newTheme === "dark");
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
