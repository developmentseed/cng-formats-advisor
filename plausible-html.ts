import type { HtmlTagDescriptor, Plugin } from 'vite';

/**
 * Adds the Plausible script tags to index.html only when a script URL is set.
 * Local builds and pull request builds have no VITE_PLAUSIBLE_SRC, so they
 * have no analytics.
 */
export function plausibleTags(src: string | undefined): HtmlTagDescriptor[] {
  const url = src?.trim();
  if (!url) return [];
  if (!/^https:\/\/[^\s"'<>]+\.js$/.test(url)) {
    throw new Error(`VITE_PLAUSIBLE_SRC must be an https URL to a .js file, got: ${url}`);
  }
  return [
    { tag: 'script', attrs: { async: true, src: url }, injectTo: 'head' },
    {
      tag: 'script',
      // The plausible.init() stub from the Plausible install snippet. The
      // options remove the URL hash: the hash holds the decision state.
      children:
        'window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},' +
        'plausible.init=plausible.init||function(i){plausible.o=i||{}};' +
        'plausible.init({transformRequest:function(p){if(p&&typeof p.u==="string"){p.u=p.u.split("#")[0]}return p}});',
      injectTo: 'head',
    },
  ];
}

export function plausiblePlugin(src: string | undefined): Plugin {
  return {
    name: 'cng-advisor-plausible',
    transformIndexHtml() {
      return plausibleTags(src);
    },
  };
}
