import React from 'react';

type ExtensionIframeProps = {
  src: string;
  title: string;
  minHeight?: string;
  className?: string;
  iframeRef?: React.Ref<HTMLIFrameElement>;
};

export const ExtensionIframe: React.FC<ExtensionIframeProps> = ({
  src,
  title,
  minHeight = '36rem',
  className = '',
  iframeRef,
}) => {
  if (!src) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        Extension page URL is missing.
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      title={title}
      src={src}
      className={`w-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950 ${className}`}
      style={{ minHeight, height: '70vh' }}
    />
  );
};
