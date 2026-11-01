<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep PC, touch, and PlayStation controller input as explicit control modes so their UI and aiming behavior never overlap.
- Casual co-op uses one capped-rate Realtime channel per room; the creator coordinates zombies, gates and shared progression, while each browser owns its player's inventory and movement.
- Room admission uses a locked database RPC with expiring capability-token membership so concurrent joins cannot exceed the party limit; table data is not directly public.
