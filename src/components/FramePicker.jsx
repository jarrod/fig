// Picks the frame shape for field designs: the isometric diamond, edge-to-edge
// fill, or a square, circle or hexagon seen from above.
import { CircleIcon, DiamondIcon, HexagonIcon, RectangleHorizontalIcon, SquareIcon } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FRAME_IDS, frameLabel } from '@/core/frame.js';

const ICONS = {
  diamond: DiamondIcon,
  fill: RectangleHorizontalIcon,
  square: SquareIcon,
  circle: CircleIcon,
  hexagon: HexagonIcon,
};

export function FramePicker({ value, onChange, disabled, ...props }) {
  return (
    <ToggleGroup
      variant="outline"
      spacing={0}
      value={[value]}
      onValueChange={(next) => next[0] && onChange(next[0])}
      disabled={disabled}
      {...props}
    >
      {FRAME_IDS.map((id) => {
        const Icon = ICONS[id];
        return (
          <Tooltip key={id}>
            <TooltipTrigger
              render={
                <ToggleGroupItem value={id} aria-label={frameLabel(id)}>
                  <Icon />
                </ToggleGroupItem>
              }
            />
            <TooltipContent>{frameLabel(id)}</TooltipContent>
          </Tooltip>
        );
      })}
    </ToggleGroup>
  );
}
