# Tiptap UI source provenance

MIT-licensed components copied from ueberdosis/tiptap-ui-components, commit 799929bea4804c73767562b69f8acc2acdb8ac86, apps/web/src. The original license is retained in LICENSE.

Only the import closure used by the Sirius toolbar is included. Local patches add per-editor translation/context, scope theme variables and tooltip/popover portals to the editor, validate link URLs, and disable modal behavior in heading menus. Sirius supplies translated button labels and uses the official Button primitive for its endpoint-backed image upload action. The upstream simulated upload handler is not used. Review these patches when updating the pinned sources.
