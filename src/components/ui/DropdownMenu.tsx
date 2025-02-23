import type { FC } from '../../lib/teact/teact';
import React, {
  useCallback, useMemo, useRef, useState, useEffect,
} from '../../lib/teact/teact';

import Icon from '../common/icons/Icon';
import Button from './Button';
import Menu from './Menu';

import './DropdownMenu.scss';

type OwnProps = {
  className?: string;
  trigger?: FC<{ onTrigger: () => void; isOpen?: boolean }>;
  transformOriginX?: number;
  transformOriginY?: number;
  positionX?: 'left' | 'right';
  positionY?: 'top' | 'bottom';
  footer?: string;
  forceOpen?: boolean;
  onOpen?: NoneToVoidFunction;
  onClose?: NoneToVoidFunction;
  onHide?: NoneToVoidFunction;
  onTransitionEnd?: NoneToVoidFunction;
  onMouseEnterBackdrop?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  children: React.ReactNode;
  autoClose?: boolean;
  triggerRef?: { current: { toggle: () => void } };
};

const DropdownMenu: FC<OwnProps> = ({
  trigger,
  className,
  children,
  transformOriginX,
  transformOriginY,
  positionX = 'left',
  positionY = 'top',
  footer,
  forceOpen,
  onOpen,
  onClose,
  onTransitionEnd,
  onMouseEnterBackdrop,
  onHide,
  autoClose = true,
  triggerRef,
}) => {
  // eslint-disable-next-line no-null/no-null
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const toggleIsOpen = useCallback(() => {
    setIsOpen(!isOpen);

    if (isOpen) {
      onClose?.();
    } else {
      onOpen?.();
    }
  }, [isOpen, onClose, onOpen]);

  useEffect(() => {
    if (triggerRef) {
      triggerRef.current = { toggle: toggleIsOpen };
    }
  }, [toggleIsOpen, triggerRef]);

  const handleKeyDown = (e: React.KeyboardEvent<any>) => {
    const menu = menuRef.current;

    if (!isOpen || e.keyCode !== 40 || !menu) {
      return;
    }

    const focusedElement = document.activeElement;
    const elementChildren = Array.from(menu.children);

    if (!focusedElement || elementChildren.indexOf(focusedElement) === -1) {
      (elementChildren[0] as HTMLElement).focus();
    }
  };

  const handleClose = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  const triggerComponent: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    if (trigger) return trigger;

    return ({ onTrigger, isOpen: isMenuOpen }) => (
      <Button
        round
        size="smaller"
        color="translucent"
        className={isMenuOpen ? 'active' : ''}
        onClick={onTrigger}
        ariaLabel="More actions"
      >
        <Icon name="more" />
      </Button>
    );
  }, [trigger]);

  return (
    <div
      className={`DropdownMenu ${className || ''}`}
      onKeyDown={handleKeyDown}
      onTransitionEnd={onTransitionEnd}
    >
      {triggerComponent({ onTrigger: toggleIsOpen, isOpen })}

      <Menu
        ref={menuRef}
        isOpen={isOpen || Boolean(forceOpen)}
        className={className || ''}
        transformOriginX={transformOriginX}
        transformOriginY={transformOriginY}
        positionX={positionX}
        positionY={positionY}
        footer={footer}
        autoClose={autoClose}
        onClose={handleClose}
        onCloseAnimationEnd={onHide}
        onMouseEnterBackdrop={onMouseEnterBackdrop}
      >
        {children}
      </Menu>
    </div>
  );
};

export default DropdownMenu;
