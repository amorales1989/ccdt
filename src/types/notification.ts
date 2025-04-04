
export interface Notification {
  id: string;
  title: string;
  message: string;
  sender_id: string;
  sender_name?: string;
  created_at: string;
  updated_at: string;
  read?: boolean;
}

export interface NotificationRecipient {
  id: string;
  notification_id: string;
  recipient_id: string;
  read: boolean;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  department_id: string | null;
  departments: string[] | null;
  assigned_class: string | null;
  email?: string;
}
