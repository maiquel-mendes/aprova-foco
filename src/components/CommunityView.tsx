import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  MessageCircle,
  MessageSquare,
  Send,
  ThumbsUp,
  Users,
} from 'lucide-react';
import { getFirebaseIdToken } from '../lib/firebase';
import {
  createForumPost,
  fetchChatHistory,
  fetchForumPosts,
  replyForumPost,
  saveChatMessage,
  upvoteForumPost,
} from '../lib/firestoreDb';
import type {
  ChatMessageItem,
  ForumPostItem,
  QuestionItem,
  UserProfile,
} from '../types';

interface CommunityViewProps {
  user: UserProfile;
  linkedQuestion: QuestionItem | null;
  onClearLinkedQuestion: () => void;
}

const CHAT_ROOMS = [
  { id: 'geral', label: 'Geral Concursos' },
  { id: 'tribunais', label: 'Tribunais' },
  { id: 'fiscal', label: 'Carreira Fiscal' },
  { id: 'policial', label: 'Policial & Segurança' },
  { id: 'bancos-ti', label: 'Bancos & TI' },
];

export const CommunityView: React.FC<CommunityViewProps> = ({
  user,
  linkedQuestion,
  onClearLinkedQuestion,
}) => {
  const [tab, setTab] = useState<'forum' | 'chat'>('forum');

  // Forum state
  const [posts, setPosts] = useState<ForumPostItem[]>([]);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Direito Constitucional');
  const [body, setBody] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [submittingPost, setSubmittingPost] = useState(false);

  // Real-time WebSocket Chat state
  const [room, setRoom] = useState('geral');
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<
    { name: string; level: number }[]
  >([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (linkedQuestion) {
      setTab('forum');
      setSubject(linkedQuestion.subject);
      setTitle(`Dúvida na questão ${linkedQuestion.code} (${linkedQuestion.board})`);
      setBody(
        `Sobre o enunciado: "${linkedQuestion.statement.slice(0, 140)}..."\nMinha dúvida é: `
      );
    }
  }, [linkedQuestion]);

  const loadForum = useCallback(async () => {
    try {
      const list = await fetchForumPosts();
      setPosts(list);
    } catch {
      // ignore offline
    }
  }, []);

  useEffect(() => {
    loadForum();
  }, [loadForum]);

  const loadChatHistory = useCallback(async (targetRoom: string) => {
    try {
      const list = await fetchChatHistory(targetRoom);
      setMessages(list);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (tab !== 'chat') return;
    loadChatHistory(room);

    let closed = false;
    let socket: WebSocket | null = null;
    const displayName = user.displayName || user.email.split('@')[0];

    (async () => {
      const token = await getFirebaseIdToken();
      if (closed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?room=${encodeURIComponent(
        room
      )}&token=${encodeURIComponent(token || '')}&name=${encodeURIComponent(
        displayName
      )}&level=${encodeURIComponent(String(user.level || 1))}`;
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (!closed) setWsConnected(true);
      };
      socket.onerror = () => {
        if (!closed) setWsConnected(false);
      };
      socket.onclose = () => {
        if (!closed) setWsConnected(false);
      };
      socket.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data);
          if (parsed.type === 'chat:new') {
            setMessages((prev) => {
              if (prev.some((m) => m.id === parsed.payload.id)) return prev;
              return [...prev, parsed.payload];
            });
          } else if (parsed.type === 'presence:update') {
            setOnlineUsers(parsed.payload.users || []);
          }
        } catch {
          // ignore malformed frame
        }
      };
    })();

    return () => {
      closed = true;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
      wsRef.current = null;
    };
  }, [tab, room, loadChatHistory, user.displayName, user.email, user.level]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSubmittingPost(true);
    try {
      const created = await createForumPost(user, {
        title,
        subject,
        body,
        questionId: linkedQuestion?.id || null,
      });
      setPosts((prev) => [created, ...prev]);
      setTitle('');
      setBody('');
      onClearLinkedQuestion();
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleReplyPost = async (postId: string) => {
    const text = replyDrafts[postId]?.trim();
    if (!text) return;
    const updated = await replyForumPost(postId, user, text);
    setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
    setReplyDrafts((prev) => ({ ...prev, [postId]: '' }));
  };

  const handleUpvote = async (postId: string) => {
    const updated = await upvoteForumPost(postId);
    setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = chatInput.trim();
    if (!clean) return;
    setChatInput('');
    try {
      const saved = await saveChatMessage(user, room, clean);
      setMessages((prev) => {
        if (prev.some((m) => m.id === saved.id)) return prev;
        return [...prev, saved];
      });
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'chat:send',
            id: saved.id,
            message: saved.message,
            authorName: saved.authorName,
            authorLevel: saved.authorLevel,
            createdAt: saved.createdAt,
          })
        );
      }
    } catch {
      // Errors surfaced via ErrorBoundary / console
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Comunidade: Fórum de Dúvidas & Chat
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Discuta questões comentadas no fórum ou troque materiais em tempo real nas salas por carreira.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 self-start">
          <button
            type="button"
            onClick={() => setTab('forum')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              tab === 'forum'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Fórum de Dúvidas
          </button>
          <button
            type="button"
            onClick={() => setTab('chat')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              tab === 'chat'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Chat Ao Vivo
          </button>
        </div>
      </div>

      {tab === 'forum' ? (
        <div className="grid lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleCreatePost}
            className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 h-fit"
          >
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Abrir Nova Discussão
            </h2>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Disciplina
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Título da Dúvida
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Diferença entre revogação e anulação"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Descrição
              </label>
              <textarea
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Detalhe seu raciocínio ou cite o item da prova..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={submittingPost || !title.trim() || !body.trim()}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {submittingPost ? 'Publicando...' : 'Publicar no Fórum'}
            </button>
          </form>

          <div className="lg:col-span-8 space-y-4">
            {posts.length === 0 ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Nenhuma dúvida publicada ainda. Inicie a primeira discussão ao lado.
              </div>
            ) : (
              posts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {post.subject} · {post.authorName} ·{' '}
                        {new Date(post.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                        {post.title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUpvote(post.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-mono-num font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <ThumbsUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      {post.upvotes}
                    </button>
                  </div>

                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
                    {post.body}
                  </p>

                  {post.repliesJson && post.repliesJson.length > 0 && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      {post.repliesJson.map((rep) => (
                        <div
                          key={rep.id}
                          className="rounded-lg bg-slate-50 dark:bg-slate-950/70 px-3.5 py-2.5 text-xs"
                        >
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {rep.author}:{' '}
                          </span>
                          <span className="text-slate-700 dark:text-slate-300">
                            {rep.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <input
                      type="text"
                      value={replyDrafts[post.id] || ''}
                      onChange={(e) =>
                        setReplyDrafts((prev) => ({
                          ...prev,
                          [post.id]: e.target.value,
                        }))
                      }
                      placeholder="Escreva uma resposta colaborativa..."
                      className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleReplyPost(post.id)}
                      className="rounded-lg bg-slate-900 dark:bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white cursor-pointer"
                    >
                      Responder
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4 h-fit">
            <div>
              <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Salas de Estudo
              </h2>
              <div className="space-y-1">
                {CHAT_ROOMS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRoom(r.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      room === r.id
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Conectados
                </span>
                <span className="font-mono-num">{onlineUsers.length}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {wsConnected ? 'WebSocket conectado em tempo real' : 'Conectando sala...'}
              </p>
            </div>
          </aside>

          <section className="lg:col-span-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-[520px]">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {CHAT_ROOMS.find((r) => r.id === room)?.label}
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Histórico sincronizado na nuvem
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {messages.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-10">
                  Nenhuma mensagem nesta sala ainda. Envie uma saudação para iniciar a troca!
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {m.authorName} · Nível {m.authorLevel}
                      </span>
                      <span className="font-mono-num">
                        {new Date(m.createdAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                      {m.message}
                    </p>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={handleSendChat}
              className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-2.5"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Compartilhe uma dúvida ou dica de estudo com a sala..."
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" /> Enviar
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};
