
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getNotifications } from '@/lib/api';
import { BellDot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface NotificationBadgeProps {
  className?: string;
}

const NotificationBadge = ({ className }: NotificationBadgeProps) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    let isMounted = true;
    
    const fetchUnreadNotifications = async () => {
      if (!user) return;
      
      try {
        const notifications = await getNotifications(user.id);
        if (isMounted) {
          const unread = notifications.filter(n => !n.is_read).length;
          setUnreadCount(unread);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };
    
    fetchUnreadNotifications();
    
    // Poll for new notifications every minute
    const interval = setInterval(fetchUnreadNotifications, 60000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user]);
  
  if (unreadCount === 0) return null;
  
  return (
    <Badge 
      variant="destructive" 
      className={cn("flex items-center gap-1 py-1", className)}
    >
      <BellDot className="h-3 w-3" />
      {unreadCount}
    </Badge>
  );
};

export default NotificationBadge;
