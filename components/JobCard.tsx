'use client';
import { useState } from 'react';
import { Phone, MapPin, CheckCircle, AlertTriangle, Lock, ChevronDown, ChevronUp, Clock, Package, RotateCcw } from 'lucide-react';
import { Job } from '@/types';
import { cn, statusColor, statusLabel, formatTime } from '@/lib/utils';

interface JobCardProps {
  job: Job;
  onStatusChange: (id: string, status: Job['status'], notes?: string) => Promise<boolean>;
  isCompleted?: boolean;
}

export default function JobCard({ job, onStatusChange, isCompleted }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showIssueInput, setShowIssueInput] = useState(false);
  const [issueNotes, setIssueNotes] = useState('');

  const handleStatus = async (status: Job['status'], notes?: string) => {
    setLoading(true);
    await onStatusChange(job.id, status, notes);
    setLoading(false);
    setShowIssueInput(false);
    setIssueNotes('');
  };

  return (
    <div className={cn(
      'bg-white rounded-2xl shadow-sm border overflow-hidden transition-all duration-200',
      isCompleted ? 'border-gray-100 opacity-80' : 'border-gray-200',
      job.status === 'Issue' && 'border-red-200 bg-red-50/30',
      job.status === 'CouldNotAccess' && 'border-orange-200 bg-orange-50/30',
      job.status === 'Done' && 'border-green-200 bg-green-50/20',
    )}>
      {/* Card Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                #{job.jobOrder}
              </span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {job.jobType}
              </span>
              {job.callAhead && (
                <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full font-medium">
                  📞 Call Ahead
                </span>
              )}
            </div>
            <h3 className="font-bold text-gray-900 text-base leading-tight">{job.customerName}</h3>
            <p className="text-sm text-gray-500 mt-0.5 truncate">{job.address}</p>
          </div>
          <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap', statusColor(job.status))}>
            {statusLabel(job.status)}
          </span>
        </div>

        {/* Completion time badge */}
        {job.completionTime && (
          <div className="flex items-center gap-1 mt-2 text-xs text-green-700">
            <Clock className="w-3 h-3" />
            <span>Completed at {formatTime(job.completionTime)}</span>
          </div>
        )}

        {/* Quick action buttons */}
        <div className="flex gap-2 mt-3">
          {job.phone && (
            <a
              href={`tel:${job.phone}`}
              className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 active:scale-95 transition-all"
            >
              <Phone className="w-4 h-4" />
              Call
            </a>
          )}
          {job.mapLink && (
            <a
              href={job.mapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 text-blue-700 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-100 active:scale-95 transition-all"
            >
              <MapPin className="w-4 h-4" />
              Map
            </a>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            className="px-3 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 active:scale-95 transition-all"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-2 bg-gray-50/50">
          {job.items && (
            <div className="flex gap-2">
              <Package className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-500">Items</p>
                <p className="text-sm text-gray-800">{job.items}</p>
              </div>
            </div>
          )}
          {job.notes && (
            <div className="bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2">
              <p className="text-xs font-medium text-yellow-700 mb-0.5">Notes</p>
              <p className="text-sm text-yellow-900">{job.notes}</p>
            </div>
          )}
          {job.frequency && (
            <p className="text-xs text-gray-400">Frequency: {job.frequency}</p>
          )}
          {job.issueNotes && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              <p className="text-xs font-medium text-red-700 mb-0.5">Issue Notes</p>
              <p className="text-sm text-red-900">{job.issueNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Issue notes input */}
      {showIssueInput && (
        <div className="border-t border-gray-100 px-4 py-3 bg-red-50/30">
          <p className="text-sm font-medium text-gray-700 mb-2">Describe the issue:</p>
          <textarea
            value={issueNotes}
            onChange={e => setIssueNotes(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
            rows={3}
            placeholder="What went wrong?"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => handleStatus('Issue', issueNotes)}
              disabled={loading}
              className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 active:scale-95 transition-all"
            >
              {loading ? 'Saving...' : 'Submit Issue'}
            </button>
            <button
              onClick={() => setShowIssueInput(false)}
              className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium active:scale-95 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons for pending jobs */}
      {!isCompleted && job.status === 'Pending' && !showIssueInput && (
        <div className="border-t border-gray-100 grid grid-cols-3 divide-x divide-gray-100">
          <button
            onClick={() => handleStatus('Done')}
            disabled={loading}
            className="flex flex-col items-center gap-1 py-3 text-green-700 hover:bg-green-50 active:bg-green-100 transition-colors disabled:opacity-40"
          >
            <CheckCircle className="w-5 h-5" />
            <span className="text-xs font-semibold">Done</span>
          </button>
          <button
            onClick={() => handleStatus('CouldNotAccess')}
            disabled={loading}
            className="flex flex-col items-center gap-1 py-3 text-orange-600 hover:bg-orange-50 active:bg-orange-100 transition-colors disabled:opacity-40"
          >
            <Lock className="w-5 h-5" />
            <span className="text-xs font-semibold">No Access</span>
          </button>
          <button
            onClick={() => setShowIssueInput(true)}
            disabled={loading}
            className="flex flex-col items-center gap-1 py-3 text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-40"
          >
            <AlertTriangle className="w-5 h-5" />
            <span className="text-xs font-semibold">Issue</span>
          </button>
        </div>
      )}

      {/* Reopen completed jobs */}
      {isCompleted && job.status !== 'Pending' && (
        <div className="border-t border-gray-100 px-4 py-2">
          <button
            onClick={() => handleStatus('Pending')}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-40"
          >
            <RotateCcw className="w-3 h-3" />
            Reopen job
          </button>
        </div>
      )}
    </div>
  );
}
