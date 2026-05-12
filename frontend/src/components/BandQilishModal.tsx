"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Phone, User } from "lucide-react";
import { useState } from "react";

import type { Product } from "@/types";
import { createLead } from "@/lib/api";
import { getRefToken } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

const PHONE_REGEX = /^\+998\d{9}$/;

interface BandQilishModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export function BandQilishModal({ product, isOpen, onClose }: BandQilishModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { push } = useToast();

  const onSubmit = async () => {
    if (!product) return;
    if (!PHONE_REGEX.test(phone)) {
      push("Telefon raqam +998XXXXXXXXX formatida bo'lsin", "error");
      return;
    }
    setLoading(true);
    try {
      await createLead({
        product_id: product.id,
        shop_id: product.shop.id,
        customer_phone: phone,
        customer_name: name || undefined,
        ref_token: getRefToken(),
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        setName("");
        setPhone("");
      }, 3000);
    } catch {
      push("Band qilishda xatolik yuz berdi", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={success ? undefined : "📞 Band qilish"}>
      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center py-6 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-text-100">Band qilindi!</h3>
            <p className="mt-2 text-sm text-text-400">
              Do'kon siz bilan tez orada bog'lanadi
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {product && (
              <div className="rounded-xl border border-border-subtle bg-surface p-3">
                <div className="text-sm font-medium text-text-100">{product.name}</div>
                <div className="price-mono text-sm text-gold-500">{new Intl.NumberFormat("uz-UZ").format(product.price)} so'm</div>
              </div>
            )}
            <Input
              label="Ism (ixtiyoriy)"
              placeholder="Ismingiz"
              value={name}
              onChange={(e) => setName(e.target.value)}
              leftIcon={<User className="h-4 w-4" />}
            />
            <Input
              label="Telefon raqam"
              placeholder="+998901234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              leftIcon={<Phone className="h-4 w-4" />}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={onClose}>
                Bekor
              </Button>
              <Button onClick={onSubmit} isLoading={loading} leftIcon={<Phone className="h-4 w-4" />}>
                Band qilish
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
