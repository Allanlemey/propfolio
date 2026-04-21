"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Newspaper, ArrowUpRight, X } from "lucide-react";
import { NEWS_ARTICLES, type Article } from "@/lib/news";

function ArticleSheet({ article, onClose }: { article: Article; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      onClick={onClose}
      style={{ background: "rgba(11,11,26,0.8)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="bg-card border-t border-border rounded-t-3xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        style={{ animation: "slideUp 0.3s cubic-bezier(0,0,0.2,1)" }}
      >
        <div className="sticky top-0 bg-card/80 backdrop-blur-md z-10 px-5 pt-4 pb-2 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-10 h-1 bg-border rounded-full" />
          </div>
          <div className="flex items-start justify-between text-left">
            <div className="space-y-1">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${article.color}`}>
                {article.category} · {article.type === "cours" ? "Formation" : "Actualité"}
              </span>
              <h2 className="text-lg font-bold text-text leading-tight">{article.title}</h2>
              <p className="text-xs text-text-secondary">{article.date}</p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-bg border border-border flex items-center justify-center text-text-secondary hover:text-text transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        
        <div className="px-5 py-6 text-sm text-text-secondary leading-relaxed">
          {article.content}
          
          <div className="mt-10 p-5 bg-accent/5 border border-accent/10 rounded-2xl text-center">
            <p className="text-xs font-bold text-text mb-2">Vous voulez aller plus loin ?</p>
            <p className="text-[11px] text-text-secondary mb-4">Inscrivez-vous à notre newsletter pour recevoir un conseil par semaine directement dans votre boîte mail.</p>
            <button className="w-full py-2.5 bg-accent text-white rounded-xl text-xs font-bold shadow-lg shadow-accent/20">
              S&apos;inscrire gratuitement
            </button>
          </div>
        </div>
        <div className="h-10" />
      </div>
      <style>{`@keyframes slideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }`}</style>
    </div>
  );
}

const CATEGORIES = ["Tous", "Fiscalité", "Marché", "Réglementation", "Financement"];

export default function ConseilsPage() {
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("Tous");
  const activeArticle = NEWS_ARTICLES.find(a => a.id === activeArticleId);

  const filteredArticles = activeCategory === "Tous"
    ? NEWS_ARTICLES
    : NEWS_ARTICLES.filter(a => a.category === activeCategory);

  return (
    <div className="px-4 pt-5 pb-20 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-text-secondary hover:text-text transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-text leading-tight">Conseils & Actualités</h1>
          <p className="text-text-secondary text-sm">{NEWS_ARTICLES.length} articles · Patrimoine immobilier</p>
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {CATEGORIES.map(cat => {
          const count = cat === "Tous" ? NEWS_ARTICLES.length : NEWS_ARTICLES.filter(a => a.category === cat).length;
          const active = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
                active ? "bg-accent text-white border-accent shadow-sm shadow-accent/20" : "bg-card text-text-secondary border-border hover:border-accent/40"
              }`}
            >
              {cat}
              {count > 0 && (
                <span className={`font-mono text-[10px] ${active ? "opacity-70" : "text-text-muted"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 gap-4">
        {filteredArticles.length === 0 ? (
          <div className="text-center py-12 text-text-secondary text-sm">Aucun article dans cette catégorie.</div>
        ) : filteredArticles.map(art => {
          const Icon = art.icon;
          return (
            <div
              key={art.id}
              onClick={() => setActiveArticleId(art.id)}
              className="bg-card border border-border rounded-2xl p-4 hover:border-accent/30 transition-all group active:scale-[0.99] cursor-pointer"
            >
              <div className="flex gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${art.color} bg-current/10`} style={{ borderColor: 'currentColor' }}>
                  <Icon size={22} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                      {art.category}
                    </span>
                    <span className="text-[10px] text-text-muted">{art.date}</span>
                  </div>
                  <h3 className="text-base font-bold text-text mb-2 group-hover:text-accent transition-colors">
                    {art.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase ${
                      art.type === "cours" ? "bg-accent/10 text-accent border border-accent/20" : "bg-green/10 text-green border border-green/20"
                    }`}>
                      {art.type === "cours" ? "Formation" : "Actualité"}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] text-text-muted font-medium ml-auto">
                      <span>Lire l&apos;article</span>
                      <ArrowUpRight size={12} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Newsletter */}
      <div className="bg-accent/5 border border-accent/10 rounded-3xl p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center text-accent mx-auto mb-4">
          <Newspaper size={28} />
        </div>
        <h3 className="text-base font-bold text-text mb-2">Ne manquez aucune opportunité</h3>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">
          Recevez chaque mardi une analyse du marché et un conseil fiscal directement par email.
        </p>
        <div className="flex gap-2">
          <input 
            type="email" 
            placeholder="votre@email.com" 
            className="flex-1 bg-bg border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors"
          />
          <button className="bg-accent text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-accent/20">
            S&apos;inscrire
          </button>
        </div>
      </div>

      {/* Article Sheet */}
      {activeArticle && (
        <ArticleSheet
          article={activeArticle}
          onClose={() => setActiveArticleId(null)}
        />
      )}
    </div>
  );
}
