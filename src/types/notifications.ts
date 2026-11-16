/** An in-app notification of the signed-in user (CRM 3.33.0, GET /notifications). */
export interface CrmNotification {
  id: string;
  title: string;
  message: string;
  /** In-app path, e.g. "/ext/travel/travellers?traveller=<id>"; '' when none. */
  link: string;
  linkLabel: string;
  source: string;
  read: boolean;
  createdAt: string | null;
}

export interface CrmNotificationFeed {
  items: CrmNotification[];
  unread: number;
}
