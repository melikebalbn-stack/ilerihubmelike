"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface CourseOption {
  id: string;
  title: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  courses: CourseOption[];
  label?: string;
  placeholder?: string;
}

export function AdminCourseSelect({
  value,
  onChange,
  courses,
  label = "Kurs",
  placeholder = "Kurs seç",
}: Props) {
  return (
    <div className="space-y-2">
      <Label>
        {label} <span className="text-red-500">*</span>
      </Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {courses.length === 0 ? (
            <div className="p-2 text-xs text-gray-500 text-center">
              Aktif kurs bulunamadı
            </div>
          ) : (
            courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.title}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
