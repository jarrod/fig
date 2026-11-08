// React wrapper for the <gen-card> element. It sets attributes itself because
// React passes a prop as a property when the element already has one of that
// name, and every element has an animate() method (Web Animations API), so
// `animate` would replace that method instead of setting the attribute.
import { useLayoutEffect, useRef } from 'react';

export function GenCard({ form, seed, detail, fig, speed, animate }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const card = ref.current;
    const attributes = { form, seed, detail, fig, speed };
    for (const [name, value] of Object.entries(attributes)) {
      if (value === undefined) card.removeAttribute(name);
      else if (card.getAttribute(name) !== String(value)) card.setAttribute(name, value);
    }
    card.toggleAttribute('animate', Boolean(animate));
  }, [form, seed, detail, fig, speed, animate]);
  return <gen-card ref={ref} />;
}
