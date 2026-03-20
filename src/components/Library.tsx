import React, { useState, useEffect } from 'react';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { collection, query, onSnapshot, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { Trash2, BookOpen, Image as ImageIcon, ExternalLink, Share2, Search, Plus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../utils/cn';
import type { LibraryItem } from '../types';

interface LibraryProps {
  childId: string;
  ownerId: string;
}

export default function Library({ childId, ownerId }: LibraryProps) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);

  useEffect(() => {
    if (!auth.currentUser || !childId) return;

    const q = query(
      collection(db, 'users', ownerId, 'children', childId, 'library'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LibraryItem[];
      setItems(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${ownerId}/children/${childId}/library`);
    });

    return () => unsubscribe();
  }, [childId]);

  const deleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!auth.currentUser || !childId) return;
    try {
      await deleteDoc(doc(db, 'users', ownerId, 'children', childId, 'library', id));
      if (selectedItem?.id === id) setSelectedItem(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${ownerId}/children/${childId}/library/${id}`);
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

  const filteredItems = items.filter(item => 
    item.title.toLowerCase().includes(search.toLowerCase()) || 
    item.subject?.toLowerCase().includes(search.toLowerCase()) ||
    item.content?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F5F5F0]">
      <div className="p-4 md:p-8 flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-serif italic mb-1">Resursbibliotek</h2>
              <p className="text-stone-500 text-sm">Dina sparade förklaringar och illustrationer.</p>
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
                  {item.type === 'image' && item.imageUrl && (
                    <div className="aspect-video relative overflow-hidden bg-stone-100">
                      <img 
                        src={item.imageUrl} 
                        alt={item.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur rounded-lg shadow-sm">
                        <ImageIcon size={14} className="text-emerald-600" />
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
                        <button 
                          onClick={(e) => deleteItem(item.id, e)}
                          className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Ta bort"
                        >
                          <Trash2 size={16} />
                        </button>
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
                {selectedItem.imageUrl && (
                  <img 
                    src={selectedItem.imageUrl} 
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
