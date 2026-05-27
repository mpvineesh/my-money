import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

function scrollElementToTop(element) {
  if (!element) return;

  if (typeof element.scrollTo === 'function') {
    element.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    return;
  }

  element.scrollTop = 0;
}

function withInstantScroll(callback) {
  const html = document.documentElement;
  const body = document.body;
  const previousHtmlBehavior = html.style.scrollBehavior;
  const previousBodyBehavior = body.style.scrollBehavior;

  html.style.scrollBehavior = 'auto';
  body.style.scrollBehavior = 'auto';

  callback();

  requestAnimationFrame(() => {
    html.style.scrollBehavior = previousHtmlBehavior;
    body.style.scrollBehavior = previousBodyBehavior;
  });
}

export default function ScrollToTop() {
  const { pathname, search } = useLocation();

  useLayoutEffect(() => {
    if (!('scrollRestoration' in window.history)) return undefined;

    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useLayoutEffect(() => {
    withInstantScroll(() => {
      window.scrollTo(0, 0);
      scrollElementToTop(document.scrollingElement);
      scrollElementToTop(document.documentElement);
      scrollElementToTop(document.body);
      scrollElementToTop(document.querySelector('.app-main'));
    });
  }, [pathname, search]);

  return null;
}
