import { useEffect } from "react";

type Meta = {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
};

function setTag(selector: string, create: () => HTMLElement, value: string, attr: string) {
  let el = document.head.querySelector(selector) as HTMLElement | null;
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

/** Atualiza title/description/canonical/OG da rota atual (SPA). */
export function usePageMeta({ title, description, canonical, image }: Meta) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    setTag('meta[name="description"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("name", "description");
      return m;
    }, description, "content");

    const url = canonical ?? window.location.origin + window.location.pathname;
    setTag('link[rel="canonical"]', () => {
      const l = document.createElement("link");
      l.setAttribute("rel", "canonical");
      return l;
    }, url, "href");

    const og: Array<[string, string]> = [
      ["og:title", title],
      ["og:description", description],
      ["og:url", url],
      ["og:type", "website"],
    ];
    if (image) og.push(["og:image", image]);
    og.forEach(([property, content]) => {
      setTag(`meta[property="${property}"]`, () => {
        const m = document.createElement("meta");
        m.setAttribute("property", property);
        return m;
      }, content, "content");
    });

    setTag('meta[name="twitter:title"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("name", "twitter:title");
      return m;
    }, title, "content");
    setTag('meta[name="twitter:description"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("name", "twitter:description");
      return m;
    }, description, "content");

    return () => {
      document.title = prevTitle;
    };
  }, [title, description, canonical, image]);
}

export default usePageMeta;
