import React from 'react';
import { GripVertical, Maximize2, Minimize2 } from 'lucide-react';

export interface ResizableDividerProps {
  onMouseDown: (e: React.MouseEvent | React.TouchEvent) => void;
  onDoubleClick?: () => void;
  isDragging: boolean;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

export const ResizableDivider: React.FC<ResizableDividerProps> = ({
  onMouseDown,
  onDoubleClick,
  isDragging,
  isMaximized = false,
  onToggleMaximize,
}) => {
  return (
    <div
      onMouseDown={onMouseDown}
      onTouchStart={onMouseDown}
      onDoubleClick={onDoubleClick}
      className={`relative group hidden md:flex items-center justify-center w-3 -ml-1.5 z-20 cursor-col-resize select-none shrink-0 transition-colors ${
        isDragging
          ? 'bg-vault-500/20 dark:bg-vault-400/20'
          : 'hover:bg-vault-500/15 dark:hover:bg-vault-400/15 bg-transparent'
      }`}
      title="Drag to resize panel | Double-click to maximize detail panel"
    >
      {/* Central Thin Divider Line */}
      <div
        className={`w-0.5 h-full transition-colors duration-150 ${
          isDragging
            ? 'bg-vault-600 dark:bg-vault-400'
            : 'bg-gray-200 dark:bg-gray-800 group-hover:bg-vault-500 dark:group-hover:bg-vault-400'
        }`}
      />

      {/* Floating Tactical Grip Handle */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 w-4 h-9 rounded-full bg-white dark:bg-gray-800 border shadow-md flex items-center justify-center transition-all duration-200 ${
          isDragging
            ? 'opacity-100 scale-110 border-vault-500 text-vault-600 dark:text-vault-400 ring-4 ring-vault-500/20'
            : 'opacity-0 group-hover:opacity-100 border-gray-300 dark:border-gray-700 text-gray-400 group-hover:text-vault-600 dark:group-hover:text-vault-400 group-hover:border-vault-500'
        }`}
      >
        <GripVertical className="w-3 h-3" />
      </div>

      {/* Quick Maximize Button (Visible on hover) */}
      {onToggleMaximize && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMaximize();
          }}
          className="absolute top-4 w-5 h-5 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 shadow-sm flex items-center justify-center text-gray-400 hover:text-vault-600 dark:hover:text-vault-400 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95"
          title={isMaximized ? 'Restore split panel' : 'Maximize detail view'}
        >
          {isMaximized ? (
            <Minimize2 className="w-3 h-3" />
          ) : (
            <Maximize2 className="w-3 h-3" />
          )}
        </button>
      )}
    </div>
  );
};
