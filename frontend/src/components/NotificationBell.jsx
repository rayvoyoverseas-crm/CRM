import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function NotificationBell() {
 const { user } = useAuth();
  
  const [items, setItems] = useState([]);
  const [reminderTasks, setReminderTasks] = useState([]);
  const [soundPlayed, setSoundPlayed] = useState(false);

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
     if (!hasActiveReminder) {
       setSoundPlayed(false);
       return;
     }
   
     if (soundPlayed) return;
   
     try {
       const AudioContext =
         window.AudioContext || window.webkitAudioContext;
   
       const audioContext = new AudioContext();
   
       const oscillator = audioContext.createOscillator();
       const gainNode = audioContext.createGain();
   
       oscillator.connect(gainNode);
       gainNode.connect(audioContext.destination);
   
       oscillator.type = "sine";
       oscillator.frequency.setValueAtTime(
         880,
         audioContext.currentTime
       );
   
       gainNode.gain.setValueAtTime(
         0.25,
         audioContext.currentTime
       );
   
       gainNode.gain.exponentialRampToValueAtTime(
         0.01,
         audioContext.currentTime + 0.7
       );
   
       oscillator.start();
       oscillator.stop(audioContext.currentTime + 0.7);
   
       setSoundPlayed(true);
     } catch (e) {
       // Browser may block sound before user interaction.
     }
   }, [hasActiveReminder, soundPlayed]);

  const readAll = async () => { await api.post("/notifications/read-all"); load(); };

  return (
    <Popover>
      <PopoverTrigger asChild>
      <button
        data-testid="notification-bell"
        className="relative p-2 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
      >
        <Bell
          className={`w-4 h-4 ${
            hasActiveReminder ? "animate-bell-ring text-[#C05B43]" : ""
          }`}
        />
      
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
          {items.length === 0 && <div className="text-xs text-stone-400 text-center py-8">You're all caught up.</div>}
          {items.map((n) => (
            <Link key={n.id} to={n.link || "#"} onClick={() => api.post(`/notifications/${n.id}/read`).then(load)} className={`block px-4 py-3 border-b border-stone-100 hover:bg-stone-50 ${!n.read ? "bg-[#C05B43]/5" : ""}`}>
              <div className="text-xs font-semibold text-stone-800">{n.title}</div>
              <div className="text-[11px] text-stone-600 mt-0.5">{n.body}</div>
              <div className="text-[10px] text-stone-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
