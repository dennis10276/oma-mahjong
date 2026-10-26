# Certain hidden pictures may enter trusted memory

Dennis confirmed that an imagined hidden picture may be remembered if it is
100% certain. The operational requirement is logical certainty from public
information, not a probability score or agreement among sampled completions.

A deduction is admissible only if every hidden board consistent with the
observer history, production rules and explicitly allowed public prior assigns
that tile the same picture. One alternative consistent assignment disproves
certainty. A search timeout, node cap or an incomplete enumeration cannot certify
the absence of alternatives. Actual hidden pictures are never a proof input.
The allowed prior that each level is winnable does not make a bounded solver's
failure evidence that an imagined board is impossible.

Keep the source of each fact distinguishable: direct observation, a proved
deduction, or a hypothetical sampled assignment. Only the first two may become
trusted same-board/salt retry knowledge. An imagined board being correct when
compared with private ground truth after a run does not retroactively justify
using it during that run.

The existing `public_matched_picture.js` provides a narrow implemented example:
an unseen tile that actually disappears together with a previously observed
tray/open partner has that partner's picture. The controller retains that
deduction across retries without claiming the tile's hidden starting role.
Its production controls cover ordinary pictures and Jokers, nonmatches, a
terminal clock loss and private-result access traps. This is not a claim that
a general constraint-based hidden-picture proof engine has been implemented.

The canonical goal already permits proved deductions. This clarification
does not alter the observer, measured actor or default profile during a run.
