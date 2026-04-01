'use client';

import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  open:          boolean;
  onClose:       () => void;
  onConfirm:     () => void;
  title?:        string;
  description?:  string;
  confirmText?:  string;
  cancelText?:   string;
  danger?:       boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title       = '确认操作',
  description = '确定要执行此操作吗？',
  confirmText = '确定',
  cancelText  = '取消',
  danger      = false,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={handleConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      {description && (
        <p className="text-sm text-zinc-600">{description}</p>
      )}
    </Modal>
  );
}
