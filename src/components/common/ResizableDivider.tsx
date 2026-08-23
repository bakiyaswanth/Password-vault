import React from 'react';
import { GripVertical, Maximize2, Minimize2 } from 'lucide-react';

export interface ResizableDividerProps {
  onMouseDown: (e: React.MouseEvent) => void;
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
      onDoubleClick={onDoubleClick}
      className={`relative group hidden md:flex items-center justify-center w-2 -ml-1 z-10 cursor-col-resize select-none shrink-0 transition-colors ${
        isDragging
          ? 'bg-vault-500/30 dark:bg-vault-400/30'
          : 'hover:bg-vault-500/20 dark:hover:bg-vault-400/20 bg-transparent'
      }`}
      title="Drag to resize panel | Double-click to maximize detail panel"
    >
      {/* Central Thin Divider Line */}
      <div
        className={`w-0.5 h-full transition-colors ${
          isDragging
            ? 'bg-vault-600 dark:bg-vault-400'
            : 'bg-gray-200 dark:bg-gray-800 group-hover:bg-vault-500 dark:group-hover:bg-vault-400'
        }`}
      />

      {/* Floating Grip Handle */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 w-4 h-8 rounded-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 shadow-sm flex items-center justify-center text-gray-400 group-hover:text-vault-600 dark:group-hover:text-vault-400 group-hover:border-vault-500 transition-all ${
          isDragging ? 'opacity-100 ring-2 ring-vault-500/30' : 'opacity-0 group-hover:opacity-100'
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
          className="absolute top-4 w-5 h-5 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 shadow-sm flex items-center justify-center text-gray-400 hover:text-vault-600 dark:hover:text-vault-400 opacity-0 group-hover:opacity-100 transition-opacity hover:scale-105"
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
