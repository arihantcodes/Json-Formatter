"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  WebSocketClient,
  type WebSocketMessage,
  type WebSocketConnection,
  type WebSocketStats,
} from "@/lib/websocket";
import {
  Play,
  Square,
  Send,
  Trash2,
  Copy,
  Download,
  Upload,
  Clipboard,
} from "lucide-react";

interface WebSocketTestingProps {
  className?: string;
}

export function WebSocketTesting({ className }: WebSocketTestingProps) {
  const [client] = useState(() => new WebSocketClient());
  const [connection, setConnection] = useState<WebSocketConnection>({
    url: "wss://echo.websocket.org",
    protocols: [],
  });
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [stats, setStats] = useState<WebSocketStats>({
    connected: false,
    messagesSent: 0,
    messagesReceived: 0,
    bytesTransferred: 0,
  });
  const [messageInput, setMessageInput] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [savedConnections, setSavedConnections] = useState<
    WebSocketConnection[]
  >([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    client.setMessageHandler((message) => {
      setMessages((prev) => [...prev, message]);
    });

    client.setStatsHandler((newStats) => {
      setStats(newStats);
    });

    client.setConnectionHandler((connected) => {
      setIsConnecting(false);
      if (connected) {
        toast({
          title: "Connected",
          description: "WebSocket connection established",
        });
      }
    });

    return () => {
      client.disconnect();
    };
  }, [client, toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleConnect = async () => {
    if (stats.connected) {
      client.disconnect();
      return;
    }

    if (!connection.url.trim()) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid WebSocket URL",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    try {
      await client.connect(connection);
    } catch (error) {
      setIsConnecting(false);
      toast({
        title: "Connection failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;

    const sent = client.sendMessage(messageInput);
    if (sent) {
      setMessageInput("");
    }
  };

  const handleClearMessages = () => {
    setMessages([]);
    toast({
      title: "Messages cleared",
      description: "All messages have been removed",
    });
  };

  const handleSaveConnection = () => {
    const name = prompt("Enter connection name:");
    if (name) {
      setSavedConnections((prev) => [
        ...prev,
        { ...connection, url: `${name}|${connection.url}` },
      ]);
      toast({
        title: "Connection saved",
        description: `Saved as "${name}"`,
      });
    }
  };

  const handleLoadConnection = (savedConnection: WebSocketConnection) => {
    const [name, url] = savedConnection.url.split("|");
    setConnection({ ...savedConnection, url });
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copied",
      description: "Message copied to clipboard",
    });
  };

  const exportMessages = () => {
    const data = JSON.stringify(messages, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `websocket-messages-${
      new Date().toISOString().split("T")[0]
    }.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatMessageContent = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  };

  return (
    <>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <Card className="">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            WebSocket Connection
            <Badge variant={stats.connected ? "default" : "secondary"}>
              {stats.connected ? "Connected" : "Disconnected"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Configure and manage WebSocket connections
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ws-url">WebSocket URL</Label>
            <Input
              id="ws-url"
              placeholder="wss://echo.websocket.org"
              value={connection.url}
              onChange={(e) =>
                setConnection((prev) => ({ ...prev, url: e.target.value }))
              }
              disabled={stats.connected}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="protocols">Protocols (comma-separated)</Label>
            <Input
              id="protocols"
              placeholder="chat, superchat"
              value={connection.protocols?.join(", ") || ""}
              onChange={(e) =>
                setConnection((prev) => ({
                  ...prev,
                  protocols: e.target.value
                    .split(",")
                    .map((p) => p.trim())
                    .filter(Boolean),
                }))
              }
              disabled={stats.connected}
            />
          </div>

          <div className="space-y-2">
            <Label>Authentication</Label>
            <Select
              value={connection.auth?.type || "none"}
              onValueChange={(value) =>
                setConnection((prev) => ({
                  ...prev,
                  auth: value === "none" ? undefined : { type: value as any },
                }))
              }
              disabled={stats.connected}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Authentication</SelectItem>
                <SelectItem value="bearer">Bearer Token</SelectItem>
                <SelectItem value="basic">Basic Auth</SelectItem>
                <SelectItem value="custom">Custom Header</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {connection.auth?.type === "bearer" && (
            <div className="space-y-2">
              <Label htmlFor="bearer-token">Bearer Token</Label>
              <Input
                id="bearer-token"
                type="password"
                placeholder="Enter bearer token"
                value={connection.auth.token || ""}
                onChange={(e) =>
                  setConnection((prev) => ({
                    ...prev,
                    auth: { ...prev.auth!, token: e.target.value },
                  }))
                }
                disabled={stats.connected}
              />
            </div>
          )}

          {connection.auth?.type === "basic" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Username"
                  value={connection.auth.username || ""}
                  onChange={(e) =>
                    setConnection((prev) => ({
                      ...prev,
                      auth: { ...prev.auth!, username: e.target.value },
                    }))
                  }
                  disabled={stats.connected}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Password"
                  value={connection.auth.password || ""}
                  onChange={(e) =>
                    setConnection((prev) => ({
                      ...prev,
                      auth: { ...prev.auth!, password: e.target.value },
                    }))
                  }
                  disabled={stats.connected}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="flex-1"
            >
              {isConnecting ? (
                "Connecting..."
              ) : stats.connected ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Disconnect
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Connect
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleSaveConnection}>
              <Upload className="w-4 h-4" />
            </Button>
          </div>

          {savedConnections.length > 0 && (
            <div className="space-y-2">
              <Label>Saved Connections</Label>
              <div className="flex flex-wrap gap-2">
                {savedConnections.map((conn, index) => {
                  const [name] = conn.url.split("|");
                  return (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => handleLoadConnection(conn)}
                    >
                      {name}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Messages</CardTitle>
              <CardDescription>
                Send and receive WebSocket messages
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportMessages}>
                <Download className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearMessages}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Textarea
              placeholder="Enter message to send..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="flex-1"
              rows={3}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!stats.connected || !messageInput.trim()}
              className="self-end"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          <ScrollArea className="h-96 border rounded-lg p-4">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 last:mb-0"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          message.type === "sent"
                            ? "default"
                            : message.type === "received"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {message.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {message.timestamp.toLocaleTimeString()}
                      </span>
                      {message.size > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ({message.size} bytes)
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyMessage(message.content)}
                    >
                      <Clipboard className="w-3 h-3" />
                    </Button>
                  </div>
                  <pre className="text-sm bg-muted p-2 rounded overflow-x-auto">
                    {formatMessageContent(message.content)}
                  </pre>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </ScrollArea>
        </CardContent>
      </Card>

     

      {stats.latency && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Latency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold">{stats.latency}ms</div>
            <p className="text-xs text-muted-foreground">
              Last ping response time
            </p>
          </CardContent>
        </Card>
      )}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Connection Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`font-bold ${stats.connected ? "text-green-600" : "text-red-600"}`}>
              {stats.connected ? "Connected" : "Disconnected"}
            </div>
            {stats.connectionTime && (
              <p className="text-xs text-muted-foreground">
                Since {stats.connectionTime.toLocaleTimeString()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Messages Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.messagesSent}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Messages Received</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.messagesReceived}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Data Transferred</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats.bytesTransferred / 1024).toFixed(1)}KB
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
