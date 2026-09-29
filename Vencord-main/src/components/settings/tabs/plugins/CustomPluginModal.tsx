/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2024 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { saveAndActivateUserPlugin } from "@api/UserPluginManager";
import { RenderModalProps } from "@vencord/discord-types";
import { Modal, React, showToast, TextInput, Toasts, useState } from "@webpack/common";

export function CustomPluginModal({ modalProps }: { modalProps: RenderModalProps; }) {
    const [pluginName, setPluginName] = useState("");
    const [pluginCode, setPluginCode] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!pluginName.trim() || !pluginCode.trim()) {
            showToast("Please enter a valid plugin name and code", Toasts.Type.FAILURE);
            return;
        }

        setIsSaving(true);
        try {
            if (VencordNative.userPlugins) {
                const plugin = await saveAndActivateUserPlugin(pluginName.trim(), pluginCode);
                showToast(`Saved and activated plugin "${plugin.name}"!`, Toasts.Type.SUCCESS);
                modalProps.onClose();
            } else {
                showToast("UserPlugins are only supported on Discord Desktop", Toasts.Type.FAILURE);
            }
        } catch (e: any) {
            showToast(`Failed to save plugin: ${e.message || e}`, Toasts.Type.FAILURE);
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const nameWithoutExt = file.name.replace(/\.js$/, "");
        setPluginName(nameWithoutExt);

        const reader = new FileReader();
        reader.onload = event => {
            if (typeof event.target?.result === "string") {
                setPluginCode(event.target.result);
            }
        };
        reader.readAsText(file);
    };

    return (
        <Modal
            {...modalProps}
            title="Import / Add Custom Plugin (.js)"
            actions={[
                {
                    text: "Save & Import Plugin",
                    onClick: handleSave,
                    disabled: isSaving || !pluginName || !pluginCode,
                    variant: "primary"
                },
                {
                    text: "Cancel",
                    onClick: modalProps.onClose,
                    variant: "secondary"
                }
            ]}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingTop: "8px" }}>
                <div>
                    <label style={{ color: "#b5bac1", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", marginBottom: "6px", display: "block" }}>
                        Select .js File or Paste Below
                    </label>
                    <input
                        type="file"
                        accept=".js"
                        onChange={handleFileUpload}
                        style={{ color: "#dbdee1" }}
                    />
                </div>

                <div>
                    <label style={{ color: "#b5bac1", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", marginBottom: "6px", display: "block" }}>
                        Plugin Name
                    </label>
                    <TextInput
                        placeholder="e.g. MyCustomPlugin"
                        value={pluginName}
                        onChange={setPluginName}
                    />
                </div>

                <div>
                    <label style={{ color: "#b5bac1", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", marginBottom: "6px", display: "block" }}>
                        Plugin JavaScript Code
                    </label>
                    <textarea
                        rows={12}
                        value={pluginCode}
                        onChange={e => setPluginCode(e.target.value)}
                        placeholder={"// Paste your Vencord definePlugin code here...\nexport default definePlugin({\n    name: \"MyCustomPlugin\",\n    description: \"My custom plugin\",\n    authors: [{ name: \"Me\", id: 0n }],\n    start() { console.log(\"Custom plugin started!\"); }\n});"}
                        style={{
                            width: "100%",
                            backgroundColor: "#1e1f22",
                            color: "#dbdee1",
                            border: "1px solid #383a40",
                            borderRadius: "4px",
                            padding: "8px",
                            fontFamily: "monospace",
                            fontSize: "13px",
                            boxSizing: "border-box",
                            resize: "vertical"
                        }}
                    />
                </div>
            </div>
        </Modal>
    );
}
