import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function NotificationBell() {
 const { user } = useAuth();
  
  const [items, setItems] = useState([]);
  const [reminderTasks, setReminderTasks] = useState([]);
 
  const unreadItems = items.filter((n) => !n.read);
  const unread = unreadItems.length;
  
  const hasActiveReminder = reminderTasks.length > 0;
  const bellCount = unread + reminderTasks.length;

  const load = async () => {
  try {
    const notificationsResponse = await api.get("/notifications");
    setItems(notificationsResponse.data || []);

    const tasksResponse = await api.get("/tasks");
    const allTasks = tasksResponse.data || [];

    const now = new Date();

    const activeReminders = allTasks.filter((task) => {
     if (task.status !== "pending") return false;
     if (!task.remind_at) return false;
   
     const currentUserId = user?.id || user?._id;
   
     if (
       currentUserId &&
       task.assigned_to &&
       task.assigned_to !== currentUserId
     ) {
       return false;
     }
   
     const reminderTime = new Date(task.remind_at);
   
     return reminderTime <= now;
   });

    setReminderTasks(activeReminders);
  } catch (e) {
    setReminderTasks([]);
  }
};

  useEffect(() => {
    load();
  
    const iv = setInterval(load, 5000);
  
    return () => clearInterval(iv);
  }, [user]);

   useEffect(() => {
     if (reminderTasks.length === 0) return;
   
     reminderTasks.forEach((task) => {
       const reminderKey =
         `reminder-alert-${task.id}-${task.remind_at}`;
   
       const alreadyAlerted =
         localStorage.getItem(reminderKey);
   
       if (alreadyAlerted) return;
   
       localStorage.setItem(reminderKey, "played");
   
       toast(`🔔 Reminder: ${task.title}`, {
         description: task.lead_name
           ? `${task.lead_name} · ${new Date(
               task.remind_at
             ).toLocaleString()}`
           : new Date(
               task.remind_at
             ).toLocaleString(),
         duration: 8000,
       });
   
       try {
         const audio =
           new Audio("/notification-bell.mp3");
   
         audio.volume = 0.8;
   
         audio.play().catch(() => {
           // Browser may block sound until user interacts with the page.
         });
       } catch (e) {
         // Ignore audio errors.
       }
     });
   }, [reminderTasks]);

  const readAll = async () => { await api.post("/notifications/read-all"); load(); };

  return (
    <Popover>
      <PopoverTrigger asChild>
      <button
        data-testid="notification-bell"
        className="relative p-2 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
      >
       <span
        className={`inline-block text-[20px] leading-none ${
          bellCount > 0
            ? "animate-bell-ring"
            : ""
        }`}
        style={{
          filter:
            bellCount > 0
              ? "hue-rotate(300deg) saturate(5) brightness(0.95)"
              : "none",
        }}
      >
        🔔
      </span>
      
        {bellCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {bellCount > 99 ? "99+" : bellCount}
        </span>
      )}
      </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
          <div className="font-display font-semibold text-sm">Notifications</div>
          {unread > 0 && <button onClick={readAll} className="text-[11px] text-[#C05B43] font-semibold">Mark all read</button>}
        </div>
        <div className="max-h-96 overflow-y-auto">
        
          {reminderTasks.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-stone-400 bg-stone-50 border-b border-stone-100">
                Active Reminders
              </div>
        
              {reminderTasks.map((task) => (
                <Link
                  key={`reminder-${task.id}`}
                  to={`/lead/${task.lead_id}`}
                  className="block px-4 py-3 border-b border-stone-100 bg-[#C05B43]/5 hover:bg-[#C05B43]/10"
                >
                  <div className="text-xs font-semibold text-stone-800">
                    Reminder: {task.title}
                  </div>
        
                  {task.lead_name && (
                    <div className="text-[11px] text-stone-600 mt-0.5">
                      {task.lead_name}
                    </div>
                  )}
        
                  {task.remind_at && (
                    <div className="text-[10px] text-[#C05B43] mt-1">
                      Reminder time:{" "}
                      {new Date(task.remind_at).toLocaleString()}
                    </div>
                  )}
        
                  {task.due_at && (
                    <div className="text-[10px] text-stone-400 mt-0.5">
                      Due:{" "}
                      {new Date(task.due_at).toLocaleString()}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        
          {items.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-stone-400 bg-stone-50 border-b border-stone-100">
                Notifications
              </div>
        
              {items.map((n) => (
                <Link
                  key={n.id}
                  to={n.link || "#"}
                  onClick={() =>
                    api
                      .post(`/notifications/${n.id}/read`)
                      .then(load)
                  }
                  className={`block px-4 py-3 border-b border-stone-100 hover:bg-stone-50 ${
                    !n.read ? "bg-[#C05B43]/5" : ""
                  }`}
                >
                  <div className="text-xs font-semibold text-stone-800">
                    {n.title}
                  </div>
        
                  <div className="text-[11px] text-stone-600 mt-0.5">
                    {n.body}
                  </div>
        
                  <div className="text-[10px] text-stone-400 mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        
          {reminderTasks.length === 0 && items.length === 0 && (
            <div className="text-xs text-stone-400 text-center py-8">
              You're all caught up.
            </div>
          )}
        
        </div>
      </PopoverContent>
    </Popover>
  );
}
