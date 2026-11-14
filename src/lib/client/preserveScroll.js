/**
 * Opening a modal shows a native <dialog>, which resets the app's scroll
 * container to the top (the layout scrolls in an `overflow-y-auto` element,
 * not the window). Call this just before opening one: it captures the scroll
 * position of every scrollable ancestor of `from` and restores it over the
 * next few frames, once the dialog has opened (the restore then sticks).
 * @param {HTMLElement | null | undefined} from - the element that triggered the modal
 * @returns {void}
 */
export function preserveScroll(from) {
    /** @type {Array<{el: HTMLElement, top: number}>} */
    const captured = [];
    for (let el = from?.parentElement; el; el = el.parentElement) {
        const overflowY = getComputedStyle(el).overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
            captured.push({ el, top: el.scrollTop });
        }
    }
    if (captured.length === 0) return;

    const restore = () => {
        for (const { el, top } of captured) {
            if (el.scrollTop !== top) el.scrollTop = top;
        }
    };
    requestAnimationFrame(restore);
    requestAnimationFrame(() => requestAnimationFrame(restore));
    setTimeout(restore, 60);
    setTimeout(restore, 180);
}
