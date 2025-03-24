
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Notification } from "@/types/database";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { markNotificationAsRead } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface NotificationDialogProps {
  notification: Notification | null;
  isOpen: boolean;
  onClose: () => void;
}

const NotificationDialog = ({ notification, isOpen, onClose }: NotificationDialogProps) => {
  const { user } = useAuth();

  const handleClose = async () => {
    if (notification && user && !notification.is_read) {
      try {
        await markNotificationAsRead(notification.id, user.id);
      } catch (error) {
        console.error("Error marking notification as read:", error);
      }
    }
    onClose();
  };

  if (!notification) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{notification.title}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(notification.created_at), { 
              addSuffix: true,
              locale: es
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="whitespace-pre-wrap">{notification.content}</div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationDialog;
