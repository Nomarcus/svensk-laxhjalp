import React, { useState, useEffect } from 'react';
import { supabase, handleDbError } from '../supabase';
import { Trash2, BookOpen, Image as ImageIcon, ExternalLink, Share2, Search, Plus, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../utils/cn';
import type { LibraryItem } from '../types';

interface LibraryProps {
  childId: string;
  ownerId: string;
}

export default function Library({ childId, ownerId }: LibraryProps) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [chatImages, setChatImages] = useState<LibraryItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'images' | 'text'>('all');

  useEffect(() => {
    if (!childId) return;

    const fetchItems = async () => {
      const { data, error } = await supabase
        .from('library_items')
        .select('*')
        .eq('child_id', childId)
        .order('created_at', { ascending: false });
      if (!error && data) setItems(data as LibraryItem[]);
    };
    fetchItems();

    const channel = supabase
      .channel(`library-${childId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'library_items', filter: `child_id=eq.${childId}` }, () => {
        fetchItems();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [childId]);

  // Fetch all AI-generated images from chat sessions
  useEffect(() => {
    if (!childId) return;

    const fetchChatImages = async () => {
      // Get all chat sessions for this child
      const { data: sessions } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('child_id', childId);

      if (!sessions || sessions.length === 0) { setChatImages([]); return; }

      const sessionIds = sessions.map(s => s.id);
      const savedImageUrls = new Set(items.filter(i => i.type === 'image' && i.image_url).map(i => i.image_url));

      // Fetch messages with generated images from these sessions
      const { data: messages } = await supabase
        .from('messages')
        .select('id, content, generated_image, created_at')
        .in('session_id', sessionIds)
        .not('generated_image', 'is', null)
        .order('created_at', { ascending: false });

      if (!messages) { setChatImages([]); return; }

      const allImages: LibraryItem[] = messages
        .filter(msg => msg.generated_image && !savedImageUrls.has(msg.generated_image))
        .map(msg => ({
          id: `chat-img-${msg.id}`,
          title: msg.content?.split('\n')[0]?.replace(/[#*]/g, '').slice(0, 50) || 'AI-illustration',
          content: msg.content || '',
          type: 'image' as const,
          image_url: msg.generated_image,
          created_at: msg.created_at || null,
          subject: 'Chatt',
        }));

      setChatImages(allImages);
    };

    fetchChatImages();
  }, [childId, ownerId, items]);

  const deleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!childId) return;
    if (id.startsWith('chat-img-')) return;
    try {
      const { error } = await supabase.from('library_items').delete().eq('id', id);
      if (error) throw error;
      if (selectedItem?.id === id) setSelectedItem(null);
    } catch (error) {
      handleDbError(error, 'delete', `library_items/${id}`);
    }
  };

  const handleShare = async (item: LibraryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const shareData = {
      title: item.title,
      text: item.content || 'Kolla in den här förklaringen!',
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${item.title}\n\n${item.content || ''}`);
        alert('Länk och text kopierad till urklipp!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  // Combine library items with chat images
  const allItems = [...items, ...chatImages];

  const filteredItems = allItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.subject?.toLowerCase().includes(search.toLowerCase()) ||
      item.content?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' ||
      (filter === 'images' && item.type === 'image') ||
      (filter === 'text' && item.type === 'text');
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F5F5F0]">
      <div className="p-4 md:p-8 flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8">
          <header className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-serif italic mb-1">Resursbibliotek</h2>
                <p className="text-stone-500 text-sm">Alla förklaringar, illustrationer och bilder.</p>
              </div>
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Sök i biblioteket..."
                  className="w-full pl-10 pr-4 py-2 bg-white border border-black/5 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {([['all', 'Alla'], ['images', 'Bilder'], ['text', 'Förklaringar']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                    filter === key
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-stone-500 border border-black/5 hover:bg-emerald-50 hover:text-emerald-700'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </header>

          {filteredItems.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-black/5 shadow-sm">
              <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center text-stone-300 mx-auto mb-4">
                <BookOpen size={32} />
              </div>
              <h3 className="text-lg font-medium text-stone-900 mb-2">Biblioteket är tomt</h3>
              <p className="text-stone-500 max-w-xs mx-auto text-sm">
                Spara förklaringar från chatten för att se dem här senare.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="bg-white rounded-2xl overflow-hidden border border-black/5 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col"
                >
                  {item.type === 'image' && item.image_url && (
                    <div className="aspect-video relative overflow-hidden bg-stone-100">
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur rounded-lg shadow-sm">
                        {item.id.startsWith('chat-img-') ? <MessageSquare size={14} className="text-blue-600" /> : <ImageIcon size={14} className="text-emerald-600" />}
                      </div>
                    </div>
                  )}
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {item.type === 'text' && (
                          <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                            <BookOpen size={14} />
                          </div>
                        )}
                        <h4 className="font-semibold text-stone-900 line-clamp-1">{item.title}</h4>
                      </div>
                    </div>
                    {item.content && (
                      <p className="text-stone-500 text-sm line-clamp-3 mb-4 flex-1">
                        {item.content.replace(/[#*`]/g, '')}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-4 border-t border-black/5 mt-auto">
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                        {item.subject || 'Allmänt'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handleShare(item, e)}
                          className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          title="Dela"
                        >
                          <Share2 size={16} />
                        </button>
                        {!item.id.startsWith('chat-img-') && (
                          <button
                            onClick={(e) => deleteItem(item.id, e)}
                            className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Ta bort"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail View Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-black/5 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  {selectedItem.type === 'image' ? <ImageIcon size={20} /> : <BookOpen size={20} />}
                </div>
                <div>
                  <h3 className="text-xl font-serif italic">{selectedItem.title}</h3>
                  <p className="text-xs text-stone-400 uppercase tracking-widest font-medium">{selectedItem.subject || 'Allmänt'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleShare(selectedItem, e)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium hover:bg-emerald-100 transition-all"
                >
                  <Share2 size={16} />
                  <span>Dela</span>
                </button>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors"
                >
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-2xl mx-auto space-y-8">
                {selectedItem.image_url && (
                  <img
                    src={selectedItem.image_url}
                    alt={selectedItem.title}
                    className="w-full rounded-2xl shadow-lg border border-black/5"
                    referrerPolicy="no-referrer"
                  />
                )}
                {selectedItem.content && (
                  <div className="markdown-body prose prose-stone prose-lg max-w-none">
                    <ReactMarkdown>{selectedItem.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
