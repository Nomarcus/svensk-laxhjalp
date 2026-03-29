import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, MessageSquare, Calendar, Sparkles, ShieldCheck, Zap, ChevronDown, Camera, Users, Library, GraduationCap, CheckCircle, HelpCircle } from 'lucide-react';

function CollapsibleSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-black/5 dark:border-white/5 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 md:p-6 text-left hover:bg-stone-50 dark:hover:bg-slate-800 transition-colors"
      >
        <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100 pr-4">{title}</h3>
        <ChevronDown size={20} className={`text-stone-400 dark:text-stone-500 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 md:px-6 pb-5 md:pb-6 pt-0 text-sm text-stone-600 dark:text-stone-300 leading-relaxed space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

export default function Info() {
  const { t } = useTranslation();
  const features = [
    {
      icon: <MessageSquare className="text-emerald-600" />,
      title: t('info.feature1Title'),
      description: t('info.feature1Desc')
    },
    {
      icon: <Camera className="text-emerald-600" />,
      title: t('info.feature2Title'),
      description: t('info.feature2Desc')
    },
    {
      icon: <Calendar className="text-emerald-600" />,
      title: t('info.feature3Title'),
      description: t('info.feature3Desc')
    },
    {
      icon: <Sparkles className="text-emerald-600" />,
      title: t('info.feature4Title'),
      description: t('info.feature4Desc')
    },
    {
      icon: <Users className="text-emerald-600" />,
      title: t('info.feature5Title'),
      description: t('info.feature5Desc')
    },
    {
      icon: <ShieldCheck className="text-emerald-600" />,
      title: t('info.feature6Title'),
      description: t('info.feature6Desc')
    }
  ];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 bg-[#F5F5F0] dark:bg-slate-950">
      <div className="max-w-3xl mx-auto space-y-10 py-6">
        {/* Header */}
        <header className="text-center space-y-4">
          <div className="inline-flex p-3 bg-emerald-100 rounded-2xl text-emerald-600 mb-2">
            <BookOpen size={32} />
          </div>
          <h1 className="text-4xl font-serif italic text-stone-900 dark:text-stone-100">{t('info.title')}</h1>
          <p className="text-lg text-stone-600 dark:text-stone-300 max-w-xl mx-auto">
            {t('info.subtitle')}
          </p>
        </header>

        {/* Feature overview cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((f, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-black/5 dark:border-white/5 hover:shadow-md transition-all">
              <div className="w-10 h-10 bg-stone-50 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-3">
                {f.icon}
              </div>
              <h3 className="text-base font-medium text-stone-900 dark:text-stone-100 mb-1">{f.title}</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>

        {/* Quick start */}
        <section className="bg-emerald-600 rounded-[2rem] p-8 md:p-10 text-white overflow-hidden relative">
          <div className="relative z-10 space-y-5">
            <div className="flex items-center gap-2 text-emerald-200 text-sm font-bold uppercase tracking-widest">
              <Zap size={16} />
              <span>{t('info.quickStartLabel')}</span>
            </div>
            <h2 className="text-2xl font-serif italic">{t('info.quickStartTitle')}</h2>
            <div className="space-y-3">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-bold text-sm">1</div>
                <p>{t('info.quickStep1')}</p>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-bold text-sm">2</div>
                <p>{t('info.quickStep2')}</p>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-bold text-sm">3</div>
                <p>{t('info.quickStep3')}</p>
              </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        </section>

        {/* Detailed collapsible sections */}
        <div>
          <h2 className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-5 text-center">{t('info.detailedGuideTitle')}</h2>
          <div className="space-y-3">

            <CollapsibleSection title={t('info.section1Title')}>
              <p>{t('info.section1P1')}</p>
              <p><strong>{t('info.section1P2Label')}</strong> {t('info.section1P2')}</p>
              <p><strong>{t('info.section1P3Label')}</strong> {t('info.section1P3')}</p>
              <p><strong>{t('info.section1P4Label')}</strong> {t('info.section1P4')}</p>
              <p><strong>{t('info.section1P5Label')}</strong> {t('info.section1P5')}</p>
              <p><strong>{t('info.section1P6Label')}</strong> {t('info.section1P6')}</p>
            </CollapsibleSection>

            <CollapsibleSection title={t('info.section2Title')}>
              <p>{t('info.section2P1')}</p>
              <p><strong>{t('info.section2P2Label')}</strong> {t('info.section2P2')}</p>
              <p><strong>{t('info.section2P3Label')}</strong> {t('info.section2P3')}</p>
              <p><strong>{t('info.section2P4Label')}</strong> {t('info.section2P4')}</p>
            </CollapsibleSection>

            <CollapsibleSection title={t('info.section3Title')}>
              <p>{t('info.section3P1')}</p>
              <p><strong>{t('info.section3P2Label')}</strong> {t('info.section3P2')}</p>
              <p><strong>{t('info.section3P3Label')}</strong> {t('info.section3P3')}</p>
              <p><strong>{t('info.section3P4Label')}</strong> {t('info.section3P4')}</p>
              <p><strong>{t('info.section3P5Label')}</strong> {t('info.section3P5')}</p>
              <p><strong>{t('info.section3P6Label')}</strong> {t('info.section3P6')}</p>
            </CollapsibleSection>

            <CollapsibleSection title={t('info.section4Title')}>
              <p>{t('info.section4P1')}</p>
              <p><strong>{t('info.section4P2Label')}</strong> {t('info.section4P2')}</p>
              <p><strong>{t('info.section4P3Label')}</strong> {t('info.section4P3')}</p>
              <p><strong>{t('info.section4P4Label')}</strong> {t('info.section4P4')}</p>
            </CollapsibleSection>

            <CollapsibleSection title={t('info.section5Title')}>
              <p>{t('info.section5P1')}</p>
              <p><strong>{t('info.section5P2Label')}</strong> {t('info.section5P2')}</p>
              <p><strong>{t('info.section5P3Label')}</strong> {t('info.section5P3')}</p>
              <p><strong>{t('info.section5P4Label')}</strong> {t('info.section5P4')}</p>
            </CollapsibleSection>

            <CollapsibleSection title={t('info.section6Title')}>
              <p>{t('info.section6P1')}</p>
              <p><strong>{t('info.section6P2Label')}</strong> {t('info.section6P2')}</p>
              <p><strong>{t('info.section6P3Label')}</strong> {t('info.section6P3')}</p>
            </CollapsibleSection>

            <CollapsibleSection title={t('info.section7Title')}>
              <p>{t('info.section7P1')}</p>
              <p><strong>{t('info.section7P2Label')}</strong> {t('info.section7P2')}</p>
            </CollapsibleSection>

            <CollapsibleSection title={t('info.section8Title')}>
              <p>{t('info.section8P1')}</p>
              <p><strong>{t('info.section8P2Label')}</strong> {t('info.section8P2')}</p>
              <p><strong>{t('info.section8P3Label')}</strong> {t('info.section8P3')}</p>
              <p><strong>{t('info.section8P4Label')}</strong> {t('info.section8P4')}</p>
            </CollapsibleSection>

            <CollapsibleSection title={t('info.section9Title')}>
              <p>{t('info.section9P1')}</p>
              <p><strong>{t('info.section9P2Label')}</strong> {t('info.section9P2')}</p>
              <p><strong>{t('info.section9P3Label')}</strong> {t('info.section9P3')}</p>
              <p><strong>{t('info.section9P4Label')}</strong> {t('info.section9P4')}</p>
              <p><strong>{t('info.section9P5Label')}</strong> {t('info.section9P5')}</p>
            </CollapsibleSection>

            <CollapsibleSection title={t('info.section10Title')}>
              <p>{t('info.section10P1')}</p>
              <p><strong>{t('info.section10P2Label')}</strong> {t('info.section10P2')}</p>
              <p><strong>{t('info.section10P3Label')}</strong> {t('info.section10P3')}</p>
              <p><strong>{t('info.section10P4Label')}</strong> {t('info.section10P4')}</p>
              <p><strong>{t('info.section10P5Label')}</strong> {t('info.section10P5')}</p>
            </CollapsibleSection>

            <CollapsibleSection title={t('info.faqTitle')}>
              <div className="space-y-5">
                <div>
                  <p className="font-medium text-stone-900 dark:text-stone-100 mb-1">{t('info.faq1Q')}</p>
                  <p>{t('info.faq1A')}</p>
                </div>
                <div>
                  <p className="font-medium text-stone-900 dark:text-stone-100 mb-1">{t('info.faq2Q')}</p>
                  <p>{t('info.faq2A')}</p>
                </div>
                <div>
                  <p className="font-medium text-stone-900 dark:text-stone-100 mb-1">{t('info.faq3Q')}</p>
                  <p>{t('info.faq3A')}</p>
                </div>
                <div>
                  <p className="font-medium text-stone-900 dark:text-stone-100 mb-1">{t('info.faq4Q')}</p>
                  <p>{t('info.faq4A')}</p>
                </div>
                <div>
                  <p className="font-medium text-stone-900 dark:text-stone-100 mb-1">{t('info.faq5Q')}</p>
                  <p>{t('info.faq5A')}</p>
                </div>
                <div>
                  <p className="font-medium text-stone-900 dark:text-stone-100 mb-1">{t('info.faq6Q')}</p>
                  <p>{t('info.faq6A')}</p>
                </div>
              </div>
            </CollapsibleSection>

          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-stone-400 dark:text-stone-500 text-sm pb-8 space-y-1">
          <p>{t('info.footerLine1')}</p>
          <p>{t('info.footerLine2')}</p>
        </footer>
      </div>
    </div>
  );
}
