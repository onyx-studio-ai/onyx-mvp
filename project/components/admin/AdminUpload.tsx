'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase, Order } from '@/lib/supabase';
import { Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AdminUploadProps {
  order: Order;
  onUploadComplete?: () => void;
}

export default function AdminUpload({ order, onUploadComplete }: AdminUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${order.id}.${fileExt}`;
    const filePath = fileName;

    setUploading(true);

    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('deliverables')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from('deliverables')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('voice_orders')
        .update({
          status: 'completed',
          download_url: publicUrl,
        })
        .eq('id', order.id);

      if (updateError) {
        throw updateError;
      }

      setUploadSuccess(true);
      toast({
        title: 'Upload Successful',
        description: `Order ${order.order_number} is now complete and ready for download.`,
      });

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload file. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  if (uploadSuccess || order.status === 'completed') {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">Order Complete - File Delivered</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-blue-400">Admin: Upload Deliverable</h4>
          <div className="text-xs text-gray-400">Order #{order.order_number}</div>
        </div>

        <div className="flex items-center gap-3">
          <Input
            type="file"
            accept=".wav,.mp3"
            onChange={handleFileUpload}
            disabled={uploading}
            className="flex-1 text-sm"
          />
          {uploading && (
            <div className="flex items-center gap-2 text-blue-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Uploading...</span>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500">
          Upload the completed audio file (.wav or .mp3). This will mark the order as complete and notify the customer.
        </p>
      </div>
    </div>
  );
}
