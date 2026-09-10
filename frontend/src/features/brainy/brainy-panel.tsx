"use client";

import { Bot, Check, Database, Loader2, MessageSquarePlus, Pencil, Send, Share2, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

import { Button, Card, Input, Text } from "@/components/atoms";
import { BirgusDialog, SelectDropdown } from "@/components/molecules";
import { ContentView, MarkdownContent } from "@/components/molecules/markdown-content";

type Agent = { id: string; label: string; isDefault: boolean };
type DatabaseConnection = { id: string; label: string };
type WorkspaceUser = { id: string; label: string; email: string };
type Chat = { id: string; title: string; kind: "AGENT" | "DATABASE"; agentId: string | null; agentLabel: string | null; databaseConnectionId: string | null; databaseLabel: string | null; updatedAt: string; ragEnabled: boolean; databaseMemoryEnabled: boolean; isOwner: boolean; canWrite: boolean; createdByUserId: string | null };
type Message = { id: string; role: string; content: string; createdAt: string };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(init?.headers ?? {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String((data as { message?: unknown }).message ?? "Richiesta Brainy non riuscita."));
  return data as T;
}

export function BrainyPanel() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [databaseConnections, setDatabaseConnections] = useState<DatabaseConnection[]>([]);
  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceUser[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [active, setActive] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [agentId, setAgentId] = useState("");
  const [databaseConnectionId, setDatabaseConnectionId] = useState("");
  const [newChatKind, setNewChatKind] = useState<"AGENT" | "DATABASE">("AGENT");
  const [sharing, setSharing] = useState(false);
  const [shareUserId, setShareUserId] = useState("");
  const [shareAccess, setShareAccess] = useState<"READ" | "WRITE">("READ");
  const [text, setText] = useState("");
  const [view, setView] = useState<ContentView>("rendered");
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [dialog, setDialog] = useState<{ message: string; onConfirm?: () => void } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const alertError = (error: unknown) => setDialog({ message: error instanceof Error ? error.message : "Operazione non riuscita." });

  const open = async (chat: Chat) => {
    try { const data = await request<{ chat: Chat; messages: Message[] }>(`/api/brainy/chats/${chat.id}`); setActive(data.chat); setMessages(data.messages); setAgentId(data.chat.agentId ?? ""); }
    catch (error) { alertError(error); }
  };
  const load = async () => {
    setLoading(true);
    try {
      const [a, d, u, c] = await Promise.all([request<{ agents: Agent[] }>("/api/brainy/agents"), request<{ connections: DatabaseConnection[] }>("/api/brainy/database-connections"), request<{ users: WorkspaceUser[] }>("/api/brainy/workspace-users"), request<{ chats: Chat[] }>("/api/brainy/chats")]);
      setAgents(a.agents); setChats(c.chats); setAgentId((value) => value || a.agents.find((item) => item.isDefault)?.id || a.agents[0]?.id || "");
      setDatabaseConnections(d.connections); setWorkspaceUsers(u.users); setDatabaseConnectionId((value) => value || d.connections[0]?.id || "");
      if (c.chats[0]) await open(c.chats[0]);
    } catch (error) { alertError(error); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (active && !sending) inputRef.current?.focus(); }, [active?.id, sending]);
  useEffect(() => { if (sending && messagesRef.current) messagesRef.current.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" }); }, [messages, sending]);

  const create = async () => {
    try { const chat = await request<Chat>("/api/brainy/chats", { method: "POST", body: JSON.stringify({ kind: newChatKind, agentId: newChatKind === "AGENT" ? agentId : undefined, databaseConnectionId: newChatKind === "DATABASE" ? databaseConnectionId : undefined, title: "Nuova chat" }) }); setChats((current) => [chat, ...current]); setActive(chat); setMessages([]); }
    catch (error) { alertError(error); }
  };
  const rename = async () => {
    if (!active || !title.trim()) return;
    try { const chat = await request<Chat>(`/api/brainy/chats/${active.id}`, { method: "PATCH", body: JSON.stringify({ title: title.trim() }) }); setActive(chat); setChats((current) => current.map((item) => item.id === chat.id ? chat : item)); setRenaming(false); }
    catch (error) { alertError(error); }
  };
  const toggleRag = async () => {
    if (!active) return;
    try { const chat = await request<Chat>(`/api/brainy/chats/${active.id}/rag`, { method: "PATCH", body: JSON.stringify({ enabled: !active.ragEnabled }) }); setActive(chat); setChats((current) => current.map((item) => item.id === chat.id ? chat : item)); }
    catch (error) { alertError(error); }
  };
  const toggleDatabaseMemory = async () => {
    if (!active) return;
    try { const chat = await request<Chat>(`/api/brainy/chats/${active.id}/database-memory`, { method: "PATCH", body: JSON.stringify({ enabled: !active.databaseMemoryEnabled }) }); setActive(chat); setChats((current) => current.map((item) => item.id === chat.id ? chat : item)); }
    catch (error) { alertError(error); }
  };
  const share = async () => {
    if (!active || !shareUserId) return;
    try { await request(`/api/brainy/chats/${active.id}/shares`, { method: "POST", body: JSON.stringify({ userId: shareUserId, accessLevel: shareAccess }) }); setSharing(false); setShareUserId(""); }
    catch (error) { alertError(error); }
  };
  const archive = async () => {
    if (!active) return;
    try { await request(`/api/brainy/chats/${active.id}`, { method: "DELETE" }); const remaining = chats.filter((item) => item.id !== active.id); setChats(remaining); setActive(null); setMessages([]); if (remaining[0]) await open(remaining[0]); }
    catch (error) { alertError(error); }
  };
  const remove = () => { if (active) setDialog({ message: `Archiviare la chat "${active.title}"?`, onConfirm: () => { setDialog(null); void archive(); } }); };
  const send = async (event: FormEvent) => {
    event.preventDefault(); if (!active || !text.trim() || sending) return;
    const user: Message = { id: `local-${Date.now()}`, role: "user", content: text.trim(), createdAt: new Date().toISOString() };
    const assistant: Message = { id: `stream-${Date.now()}`, role: "assistant", content: "", createdAt: new Date().toISOString() };
    setText(""); setSending(true); setMessages((current) => [...current, user]);
    try {
      const response = await fetch(`/api/brainy/chats/${active.id}/messages/stream`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: user.content }) });
      if (!response.ok || !response.body) throw new Error("Invio non riuscito.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let added = false;
      const consume = (eventText: string) => {
        const type = eventText.match(/^event:\s*(.+)$/m)?.[1]?.trim(); const data = eventText.match(/^data:\s*(.+)$/m)?.[1]; if (!data) return;
        const payload = JSON.parse(data) as { text?: string; message?: string; userMessage?: Message; assistantMessage?: Message };
        if (type === "error") throw new Error(payload.message ?? "Invio non riuscito.");
        if (type === "delta" && payload.text !== undefined) { if (!added) { added = true; setMessages((current) => [...current, assistant]); } setMessages((current) => current.map((item) => item.id === assistant.id ? { ...item, content: item.content + payload.text } : item)); }
        if (type === "done" && payload.userMessage && payload.assistantMessage) setMessages((current) => { const next = current.map((item) => item.id === user.id ? payload.userMessage! : item); return added ? next.map((item) => item.id === assistant.id ? payload.assistantMessage! : item) : [...next, payload.assistantMessage!]; });
      };
      while (true) { const next = await reader.read(); if (next.done) break; buffer += decoder.decode(next.value, { stream: true }); const events = buffer.split(/\r?\n\r?\n/); buffer = events.pop() ?? ""; events.forEach(consume); }
      if (buffer.trim()) consume(buffer);
    } catch (error) { setMessages((current) => current.filter((item) => item.id !== user.id && item.id !== assistant.id)); setText(user.content); alertError(error); }
    finally { setSending(false); }
  };

  return <div className="flex h-[calc(100dvh-10rem)] min-h-[420px] max-h-[760px] flex-col gap-4">
    <header className="flex items-center justify-between border-b border-border-subtle pb-3"><div className="flex items-center gap-2"><Bot size={22} className="text-brand-primary" /><Text as="h1" variant="h1">Brainy</Text></div><div className="flex gap-2"><SelectDropdown className="w-28" size="sm" value={newChatKind} options={[{ value: "AGENT", label: "Agente" }, { value: "DATABASE", label: "Database" }]} onChange={(value) => setNewChatKind(value as "AGENT" | "DATABASE")} />{newChatKind === "AGENT" ? <SelectDropdown className="w-52" size="sm" value={agentId} options={agents.map((item) => ({ value: item.id, label: item.isDefault ? `${item.label} (predefinito)` : item.label }))} onChange={setAgentId} placeholder="Seleziona agente" /> : <SelectDropdown className="w-52" size="sm" value={databaseConnectionId} options={databaseConnections.map((item) => ({ value: item.id, label: item.label }))} onChange={setDatabaseConnectionId} placeholder="Seleziona database" />}<Button size="sm" disabled={newChatKind === "AGENT" ? !agentId : !databaseConnectionId} onClick={() => void create()}><MessageSquarePlus size={16} />Nuova chat</Button></div></header>
    {loading ? <div className="flex flex-1 items-center justify-center"><Loader2 className="animate-spin" /></div> : <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]"><Card className="min-h-0 overflow-y-auto p-2">{chats.map((chat) => <button key={chat.id} type="button" onClick={() => void open(chat)} className={`w-full rounded-md p-3 text-left ${active?.id === chat.id ? "bg-bg-subtle" : "hover:bg-bg-subtle"}`}><span className="block truncate text-sm font-semibold">{chat.title}</span><span className="block truncate text-xs text-text-muted">{chat.kind === "DATABASE" ? chat.databaseLabel : chat.agentLabel}</span></button>)}</Card><Card className="flex min-h-0 flex-col p-0"><div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3"><div className="min-w-0 flex-1">{renaming ? <div className="flex gap-1"><Input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus /><Button variant="ghost" size="sm" onClick={() => void rename()}><Check size={16} /></Button><Button variant="ghost" size="sm" onClick={() => setRenaming(false)}><X size={16} /></Button></div> : <><div className="flex items-center gap-1"><Text as="h2" variant="h2" className="truncate text-base">{active?.title ?? "Seleziona una chat"}</Text>{active?.canWrite ? <Button variant="ghost" size="sm" onClick={() => { setTitle(active.title); setRenaming(true); }}><Pencil size={15} /></Button> : null}</div>{active ? <Text variant="caption">{active.kind === "DATABASE" ? active.databaseLabel : active.agentLabel}</Text> : null}</>}</div>{active ? <div className="flex items-center gap-2">{active.kind === "AGENT" ? <button type="button" disabled={!active.canWrite} role="switch" aria-checked={active.ragEnabled} onClick={() => void toggleRag()} className="flex h-8 items-center gap-1.5 text-xs font-semibold"><span>Knowledge</span><span className={`relative inline-flex h-5 w-10 items-center rounded-full p-0.5 ${active.ragEnabled ? "bg-brand-primary text-text-inverse" : "bg-bg-muted"}`}><span className="absolute left-1.5 text-[8px]">{active.ragEnabled ? "ON" : ""}</span><span className={`h-4 w-4 rounded-full bg-white transition-transform ${active.ragEnabled ? "translate-x-5" : ""}`} /></span></button> : <button type="button" disabled={!active.canWrite} role="switch" aria-checked={active.databaseMemoryEnabled} onClick={() => void toggleDatabaseMemory()} className="flex h-8 items-center gap-1.5 text-xs font-semibold"><Database size={15} /><span>Memoria</span><span className={`relative inline-flex h-5 w-10 items-center rounded-full p-0.5 ${active.databaseMemoryEnabled ? "bg-brand-primary text-text-inverse" : "bg-bg-muted"}`}><span className={`h-4 w-4 rounded-full bg-white transition-transform ${active.databaseMemoryEnabled ? "translate-x-5" : ""}`} /></span></button>}<div className="inline-flex overflow-hidden rounded-md border border-border-default"><button type="button" className={`h-8 px-2 text-xs ${view === "rendered" ? "bg-brand-primary text-text-inverse" : ""}`} onClick={() => setView("rendered")}>.md</button><button type="button" className={`h-8 border-l border-border-default px-2 text-xs ${view === "text" ? "bg-brand-primary text-text-inverse" : ""}`} onClick={() => setView("text")}>.txt</button></div>{active.isOwner ? <><Button variant="ghost" size="sm" onClick={() => setSharing((value) => !value)}><Share2 size={16} /></Button><Button variant="ghost" size="sm" className="text-status-danger-text" onClick={() => void remove()}><Trash2 size={16} /></Button></> : null}</div> : null}</div>{sharing && active?.isOwner ? <div className="flex gap-2 border-b border-border-subtle p-3"><SelectDropdown className="flex-1" size="sm" value={shareUserId} options={workspaceUsers.filter((user) => user.id !== active.createdByUserId).map((user) => ({ value: user.id, label: user.label }))} onChange={setShareUserId} placeholder="Utente del workspace" /><SelectDropdown className="w-28" size="sm" value={shareAccess} options={[{ value: "READ", label: "Lettura" }, { value: "WRITE", label: "Scrittura" }]} onChange={(value) => setShareAccess(value as "READ" | "WRITE")} /><Button size="sm" disabled={!shareUserId} onClick={() => void share()}>Condividi</Button></div> : null}<div ref={messagesRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">{messages.map((item) => <div key={item.id} className={item.role === "user" ? "ml-auto w-fit max-w-[80%] break-words rounded-md bg-brand-primary px-3 py-2 text-sm text-text-inverse" : "mr-auto w-fit max-w-[80%] break-words rounded-md bg-bg-subtle px-3 py-2 text-sm"}>{item.role === "assistant" ? <MarkdownContent content={item.content} view={view} /> : item.content}</div>)}</div><form onSubmit={send} className="flex gap-2 border-t border-border-subtle p-3"><Input ref={inputRef} value={text} disabled={!active || !active.canWrite || sending} onChange={(event) => setText(event.target.value)} placeholder={active ? active.canWrite ? "Scrivi un messaggio" : "Chat in sola lettura" : "Crea o seleziona una chat"} /><Button type="submit" disabled={!active || !active.canWrite || !text.trim() || sending}>{sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</Button></form></Card></div>}
    <BirgusDialog open={dialog !== null} message={dialog?.message ?? ""} onCancel={() => setDialog(null)} onConfirm={dialog?.onConfirm} confirmLabel="Archivia" />
  </div>;
}
