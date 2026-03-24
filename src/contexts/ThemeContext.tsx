
import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCompany, updateCompany } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { createTheme, ThemeProvider as MUIThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

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
    queryKey: ["company"],
    queryFn: () => getCompany(1),
  });

  // Update company settings when dark mode is toggled
  const { mutate } = useMutation({
    mutationFn: (darkMode: boolean) => updateCompany(1, { dark_mode: darkMode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
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

  // Create Material UI Theme
  const muiTheme = useMemo(() => {
    return createTheme({
      palette: {
        mode: theme,
        primary: {
          main: '#D6BCFA', // HSL 262 88% 74% approx (light purple)
        },
        secondary: {
          main: '#6B46C1', // HSL 262 29% 54% approx (darker purple)
        },
        background: {
          default: theme === 'dark' ? '#09090b' : '#ffffff',
          paper: theme === 'dark' ? '#18181b' : '#ffffff',
        },
        text: {
          primary: theme === 'dark' ? '#f8f8f8' : '#09090b',
        }
      },
      shape: {
        borderRadius: 16,
      },
      components: {
        MuiDialog: {
          styleOverrides: {
            paper: {
              backgroundImage: 'none',
              backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
              borderRadius: 24,
              boxShadow: theme === 'dark'
                ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                : '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              textTransform: 'none',
              borderRadius: 12,
              fontWeight: 600,
            },
          },
        },
      },
    });
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <MUIThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
